/**
 * @file Discord bot connector core
 * @description Enforces operator-owned scope, Discord bot identity, bounded
 *   transport, and safe message projection before data reaches MCP tools.
 * @module core
 * @architecture One service instance serializes all Discord traffic and keeps
 *   only short-lived rate/denial state. It never stores message content.
 * @seeAlso docs/specs/architecture.md
 * @seeAlso docs/specs/security.md
 */

const API_ORIGIN = 'https://discord.com/api/v10';
const SNOWFLAKE = /^[1-9][0-9]{16,19}$/;
const MAX_SNOWFLAKE = (1n << 64n) - 1n;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_ERROR_BYTES = 16 * 1024;
const REQUEST_DEADLINE_MS = 10_000;
const OPERATION_DEADLINE_MS = 30_000;
const MAX_PENDING_OPERATIONS = 20;
const DENIAL_COOLDOWN_MS = 10_000;
const FALLBACK_RATE_PAUSE_MS = 1_000;
const MAX_CONTENT_PER_MESSAGE = 4_000;
const MAX_CONTENT_PER_RESULT = 32_000;
const CONTENT_ACCESS_CAVEAT = 'Message content may be empty when Discord has not granted the bot Message Content access.';

/** Stable, non-sensitive errors that can cross the MCP boundary. */
export type SafeErrorCode =
  | 'INVALID_INPUT' | 'SCOPE_DENIED' | 'ACCESS_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED' | 'RATE_LIMITED' | 'DEADLINE_EXCEEDED'
  | 'UPSTREAM_FAILURE' | 'WRITE_OUTCOME_UNKNOWN' | 'BUSY' | 'CANCELLED';

/**
 * An error with a fixed public code and message. Upstream bodies, transport
 * errors and configured secrets must never be attached as a cause.
 */
export class SafeError extends Error {
  /** Machine-readable category for the MCP adapter. */
  readonly code: SafeErrorCode;

  constructor(code: SafeErrorCode) {
    const messages: Record<SafeErrorCode, string> = {
      INVALID_INPUT: 'Invalid Discord connector input.',
      SCOPE_DENIED: 'Discord resource is outside the configured scope.',
      ACCESS_UNAVAILABLE: 'Discord resource is unavailable to this bot.',
      AUTHENTICATION_FAILED: 'Discord bot authentication failed.',
      RATE_LIMITED: 'Discord rate limit requires a later retry.',
      DEADLINE_EXCEEDED: 'Discord operation deadline exceeded.',
      UPSTREAM_FAILURE: 'Discord request failed.',
      WRITE_OUTCOME_UNKNOWN: 'Discord send outcome is unknown; inspect the destination before another send.',
      BUSY: 'Discord connector is busy; retry later.',
      CANCELLED: 'Discord operation was cancelled before a send.',
    };
    super(messages[code]);
    this.name = 'SafeError';
    this.code = code;
  }
}

/** Operator-owned policy loaded once from the launcher environment. */
export interface DiscordConfig {
  /** Bot credential; never passed in a tool argument or result. */
  botToken: string;
  /** Exact server IDs the bot may expose. */
  guildIds: ReadonlySet<string>;
  /** Exact channel IDs, including each individually authorized thread. */
  channelIds: ReadonlySet<string>;
  /** Whether the optional send capability may be exposed. */
  enableWrites: boolean;
  /** Writable subset of the readable channel IDs. */
  writeChannelIds: ReadonlySet<string>;
}

/** A minimal guild projection with no permission or membership payload. */
export interface GuildSummary { id: string; name: string }

/** A minimal allowed channel projection; parentId is present for threads. */
export interface ChannelSummary {
  id: string;
  guildId: string;
  name: string;
  type: number;
  /** Forum parents can authorize threads but have no direct message history. */
  readable: boolean;
  parentId?: string;
}

/** Untrusted Discord message text with server-owned provenance. */
export interface SafeMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  timestamp: string;
  contentTruncated: boolean;
}

/** Input for one bounded channel history page. */
export interface ReadMessagesInput {
  channelId: string;
  limit?: number;
  /** Opaque channel-bound cursor returned by a prior read. */
  before?: string;
}

/** One projected page; original Discord objects never escape this type. */
export interface ReadMessagesResult {
  guildId: string;
  channelId: string;
  messages: SafeMessage[];
  /** Cursor for the oldest returned message, valid only for this channel. */
  nextBefore?: string;
  truncated: boolean;
  source: 'discord';
  untrusted: true;
  contentAccessCaveat: string;
}

/** Input for one explicitly addressed, plain-text bot message. */
export interface SendMessageInput {
  channelId: string;
  content: string;
  replyToMessageId?: string;
}

/** Internal test seams; no endpoint or credential override is available. */
export interface DiscordServiceOptions {
  /** Inject a synthetic HTTP peer in tests; production uses global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Inject a clock-controlled wait in tests. */
  sleep?: (milliseconds: number) => Promise<void>;
  /** Inject a clock in tests; production uses wall-clock milliseconds. */
  now?: () => number;
  /** Tests may shorten an attempt; runtime values cannot extend the 10s cap. */
  requestTimeoutMs?: number;
}

/** Host cancellation never acts as proof of a completed or rejected POST. */
export interface OperationOptions {
  /** Host cancellation stops queued/GET work and guards optional sends. */
  signal?: AbortSignal;
}

/**
 * Parse all operator configuration, rejecting ambiguous or broad policy.
 *
 * @param env - Launcher environment; not MCP/model input.
 * @returns A validated configuration for one trust domain.
 * @throws {SafeError} If a required value or allowlist is invalid.
 */
export function loadConfig(env: Record<string, string | undefined>): DiscordConfig {
  const botToken = env.DISCORD_BOT_TOKEN;
  if (!botToken || botToken.trim() !== botToken || /\s/.test(botToken)) throw new SafeError('INVALID_INPUT');
  const guildIds = parseIds(env.DISCORD_GUILD_IDS);
  const channelIds = parseIds(env.DISCORD_CHANNEL_IDS);
  const rawWrites = env.DISCORD_ENABLE_WRITES;
  if (rawWrites !== undefined && rawWrites !== 'true' && rawWrites !== 'false') throw new SafeError('INVALID_INPUT');
  const enableWrites = rawWrites === 'true';
  // A copied read-only template may contain an intentionally blank write list.
  if (!enableWrites && env.DISCORD_WRITE_CHANNEL_IDS?.trim()) throw new SafeError('INVALID_INPUT');
  const writeChannelIds = enableWrites ? parseIds(env.DISCORD_WRITE_CHANNEL_IDS) : new Set<string>();
  for (const id of writeChannelIds) if (!channelIds.has(id)) throw new SafeError('INVALID_INPUT');
  return { botToken, guildIds, channelIds, enableWrites, writeChannelIds };
}

/** Rejects numeric coercion because Discord snowflakes exceed safe JS integers. */
function validId(id: unknown): id is string {
  return typeof id === 'string' && SNOWFLAKE.test(id) && BigInt(id) <= MAX_SNOWFLAKE;
}

/** Lists are exact and deliberately reject empty entries, including trailing commas. */
function parseIds(raw: string | undefined): Set<string> {
  if (!raw) throw new SafeError('INVALID_INPUT');
  const parts = raw.split(',');
  if (parts.length > 200 || parts.some(part => !validId(part.trim()))) throw new SafeError('INVALID_INPUT');
  return new Set(parts.map(part => part.trim()));
}

/** Parses a bounded upstream JSON object without reflecting malformed content. */
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SafeError('UPSTREAM_FAILURE');
  return value as Record<string, unknown>;
}

/** Accepts only short text fields so names cannot inflate MCP results. */
function shortText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new SafeError('UPSTREAM_FAILURE');
  return value.slice(0, maxLength);
}

/** Returns the major resource key used by Discord's rate-limit buckets. */
function majorResource(path: string): string {
  const match = /^\/(channels|guilds)\/([0-9]+)/.exec(path);
  return match ? `${match[1]}:${match[2]}` : 'global';
}

/** Groups routes without allowing a caller to supply arbitrary destinations. */
function routeKey(method: 'GET' | 'POST', path: string): string {
  return `${method} ${path.replace(/[0-9]{17,20}/g, ':id')}`;
}

/**
 * A local, bot-only Discord adapter. Each public operation validates inputs
 * before queueing and intersects configured scope with live Discord access.
 */
export class DiscordService {
  private readonly config: DiscordConfig;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly requestTimeoutMs: number;
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private verifiedIdentity: { id: string; username: string } | undefined;
  private credentialRejected = false;
  private globalPauseUntil = 0;
  private readonly routeBuckets = new Map<string, string>();
  private readonly bucketPauseUntil = new Map<string, number>();
  private readonly deniedUntil = new Map<string, number>();

  /**
   * Create one process-local adapter; injected HTTP and clock hooks support
   * deterministic tests but production cannot change Discord's API origin.
   * @param config - Validated policy and bot credential from loadConfig.
   * @param options - Optional test seams; no runtime API-origin override.
   */
  constructor(config: DiscordConfig, options: DiscordServiceOptions = {}) {
    this.config = {
      botToken: config.botToken,
      guildIds: new Set(config.guildIds),
      channelIds: new Set(config.channelIds),
      enableWrites: config.enableWrites,
      writeChannelIds: new Set(config.writeChannelIds),
    };
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? Date.now;
    this.requestTimeoutMs = Math.min(REQUEST_DEADLINE_MS, Math.max(1, options.requestTimeoutMs ?? REQUEST_DEADLINE_MS));
  }

  /**
   * Advertise exact local capabilities, including the personal-DM gap.
   * @returns A fixed capability statement; it does not query Discord.
   */
  capabilities(): { mode: 'bot-channels'; writesEnabled: boolean; personalDmsAvailable: false; dmExplanation: string } {
    return {
      mode: 'bot-channels', writesEnabled: this.config.enableWrites,
      personalDmsAvailable: false,
      dmExplanation: 'This bot cannot access the logged-in person’s existing direct messages.',
    };
  }

  /**
   * Verify the supplied credential belongs to a bot before any channel data.
   * A 401 or non-bot response latches the process closed until restart.
   * @param options - Optional host cancellation signal.
   * @returns Minimal verified bot identity.
   * @throws {SafeError} If the credential is rejected or not a bot.
   */
  async verifyIdentity(options: OperationOptions = {}): Promise<{ id: string; username: string }> {
    return this.serialized(deadline => this.ensureIdentity(deadline, options.signal), options.signal);
  }

  /**
   * Fetch only configured guilds and project their IDs and names.
   * @param options - Optional host cancellation signal.
   * @returns Minimal untrusted metadata from allowed guilds.
   * @throws {SafeError} If Discord access or the operation budget fails.
   */
  async listGuilds(options: OperationOptions = {}): Promise<{ guilds: GuildSummary[]; source: 'discord'; untrusted: true }> {
    return this.serialized(async deadline => {
      await this.ensureIdentity(deadline, options.signal);
      const guilds: GuildSummary[] = [];
      for (const id of this.config.guildIds) {
        const raw = asRecord(await this.request('GET', `/guilds/${id}`, deadline, undefined, options.signal));
        if (raw.id !== id) throw new SafeError('UPSTREAM_FAILURE');
        guilds.push({ id, name: shortText(raw.name, 100) });
      }
      return { guilds, source: 'discord', untrusted: true };
    }, options.signal);
  }

  /**
   * Fetch current metadata for configured channels in one configured guild.
   * @param guildId - Exact configured Discord guild snowflake.
   * @param options - Optional host cancellation signal.
   * @returns Minimal untrusted channel metadata, including forum-only parents.
   * @throws {SafeError} If scope or current Discord access fails.
   */
  async listChannels(guildId: string, options: OperationOptions = {}):
    Promise<{ channels: ChannelSummary[]; source: 'discord'; untrusted: true }> {
    this.requireGuild(guildId);
    return this.serialized(async deadline => {
      await this.ensureIdentity(deadline, options.signal);
      const channels: ChannelSummary[] = [];
      for (const id of this.config.channelIds) {
        const metadata = await this.channelMetadata(id, deadline, options.signal, true);
        if (metadata.guildId === guildId) channels.push(metadata);
      }
      return { channels, source: 'discord', untrusted: true };
    }, options.signal);
  }

  /**
   * Read one page from an exact allowed channel with a channel-bound cursor.
   * Content is untrusted; nested Discord message fields never escape.
   * @param input - Exact channel, one-page limit and optional channel cursor.
   * @param options - Optional host cancellation signal.
   * @returns Bounded text and an honest cursor based on returned messages.
   * @throws {SafeError} If scope, schema, access or budget validation fails.
   */
  async readMessages(input: ReadMessagesInput, options: OperationOptions = {}): Promise<ReadMessagesResult> {
    this.requireChannel(input.channelId);
    const limit = input.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new SafeError('INVALID_INPUT');
    let beforeId: string | undefined;
    if (input.before !== undefined) {
      if (typeof input.before !== 'string') throw new SafeError('INVALID_INPUT');
      const parts = input.before.split(':');
      if (parts.length !== 2 || parts[0] !== input.channelId || !validId(parts[1])) throw new SafeError('INVALID_INPUT');
      beforeId = parts[1];
    }
    return this.serialized(async deadline => {
      await this.ensureIdentity(deadline, options.signal);
      const metadata = await this.channelMetadata(input.channelId, deadline, options.signal);
      const query = new URLSearchParams({ limit: String(limit) });
      if (beforeId) query.set('before', beforeId);
      const raw = await this.request('GET', `/channels/${input.channelId}/messages?${query}`, deadline,
        undefined, options.signal);
      if (!Array.isArray(raw) || raw.length > limit) throw new SafeError('UPSTREAM_FAILURE');
      const messages: SafeMessage[] = [];
      let totalContent = 0;
      let truncated = false;
      for (const item of raw) {
        const data = asRecord(item);
        if (!validId(data.id) || data.channel_id !== input.channelId) throw new SafeError('UPSTREAM_FAILURE');
        const author = asRecord(data.author);
        if (!validId(author.id) || typeof data.content !== 'string' || typeof data.timestamp !== 'string' ||
            data.timestamp.length > 64 ||
            !Number.isFinite(Date.parse(data.timestamp))) throw new SafeError('UPSTREAM_FAILURE');
        const remaining = MAX_CONTENT_PER_RESULT - totalContent;
        if (remaining === 0) { truncated = true; break; }
        const content = data.content.slice(0, Math.min(MAX_CONTENT_PER_MESSAGE, remaining));
        const contentTruncated = content.length < data.content.length;
        messages.push({ id: data.id, channelId: input.channelId, authorId: author.id,
          content, timestamp: data.timestamp, contentTruncated });
        totalContent += content.length;
        truncated ||= contentTruncated;
      }
      if (messages.length < raw.length) truncated = true;
      const oldest = messages.at(-1)?.id;
      return {
        guildId: metadata.guildId, channelId: input.channelId, messages,
        ...(oldest ? { nextBefore: `${input.channelId}:${oldest}` } : {}),
        truncated, source: 'discord', untrusted: true, contentAccessCaveat: CONTENT_ACCESS_CAVEAT,
      };
    }, options.signal);
  }

  /**
   * Send one plain-text message after current channel and optional reply checks.
   * Unknown POST outcomes are never retried automatically.
   * @param input - Exact write channel, bounded content and optional reply ID.
   * @param options - Optional host cancellation signal.
   * @returns The sent message ID only after validated Discord confirmation.
   * @throws {SafeError} Including WRITE_OUTCOME_UNKNOWN after ambiguous dispatch.
   */
  async sendMessage(input: SendMessageInput, options: OperationOptions = {}): Promise<{ id: string; channelId: string }> {
    if (!this.config.enableWrites) throw new SafeError('SCOPE_DENIED');
    this.requireChannel(input.channelId);
    if (!this.config.writeChannelIds.has(input.channelId)) throw new SafeError('SCOPE_DENIED');
    if (typeof input.content !== 'string' || input.content.trim().length < 1 || input.content.length > 2_000) {
      throw new SafeError('INVALID_INPUT');
    }
    if (input.replyToMessageId !== undefined && !validId(input.replyToMessageId)) throw new SafeError('INVALID_INPUT');
    return this.serialized(async deadline => {
      await this.ensureIdentity(deadline, options.signal);
      const metadata = await this.channelMetadata(input.channelId, deadline, options.signal);
      // SECURITY: The first release deliberately excludes thread writes.
      if (metadata.type !== 0 && metadata.type !== 5) throw new SafeError('SCOPE_DENIED');
      if (input.replyToMessageId) {
        const target = asRecord(await this.request('GET',
          `/channels/${input.channelId}/messages/${input.replyToMessageId}`, deadline, undefined, options.signal));
        if (target.id !== input.replyToMessageId || target.channel_id !== input.channelId) {
          throw new SafeError('SCOPE_DENIED');
        }
      }
      const body = {
        content: input.content,
        tts: false,
        // SECURITY: A URL must not create a link preview; text must not ping anyone.
        flags: 4,
        allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
        ...(input.replyToMessageId ? { message_reference: {
          message_id: input.replyToMessageId, channel_id: input.channelId, fail_if_not_exists: true,
        } } : {}),
      };
      // SECURITY: Cancellation immediately before dispatch must prevent a send.
      this.requireActive(options.signal);
      const posted = await this.request('POST', `/channels/${input.channelId}/messages`, deadline, body, options.signal);
      let raw: Record<string, unknown>;
      try { raw = asRecord(posted); }
      catch { throw new SafeError('WRITE_OUTCOME_UNKNOWN'); }
      if (!validId(raw.id) || raw.channel_id !== input.channelId) throw new SafeError('WRITE_OUTCOME_UNKNOWN');
      return { id: raw.id, channelId: input.channelId };
    }, options.signal);
  }

  /** Reject malformed or unconfigured guilds before touching Discord. */
  private requireGuild(id: unknown): asserts id is string {
    if (!validId(id)) throw new SafeError('INVALID_INPUT');
    if (!this.config.guildIds.has(id)) throw new SafeError('SCOPE_DENIED');
  }

  /** Reject malformed or unconfigured channels before touching Discord. */
  private requireChannel(id: unknown): asserts id is string {
    if (!validId(id)) throw new SafeError('INVALID_INPUT');
    if (!this.config.channelIds.has(id)) throw new SafeError('SCOPE_DENIED');
  }

  /** Avoid repeated bot identity calls without caching channel authorization. */
  private async ensureIdentity(deadline: number, signal?: AbortSignal): Promise<{ id: string; username: string }> {
    this.requireActive(signal);
    if (this.credentialRejected) throw new SafeError('AUTHENTICATION_FAILED');
    if (this.verifiedIdentity) return this.verifiedIdentity;
    const raw = asRecord(await this.request('GET', '/users/@me', deadline, undefined, signal));
    if (raw.bot !== true || !validId(raw.id) || typeof raw.username !== 'string') {
      this.credentialRejected = true;
      throw new SafeError('AUTHENTICATION_FAILED');
    }
    this.verifiedIdentity = { id: raw.id, username: raw.username.slice(0, 100) };
    return this.verifiedIdentity;
  }

  /** Validate the live channel, and both explicit scopes for a thread. */
  private async channelMetadata(id: string, deadline: number, signal?: AbortSignal, metadataOnly = false):
    Promise<ChannelSummary> {
    this.requireChannel(id);
    const raw = asRecord(await this.request('GET', `/channels/${id}`, deadline, undefined, signal));
    if (raw.id !== id || !validId(raw.guild_id) || !this.config.guildIds.has(raw.guild_id)) {
      throw new SafeError('SCOPE_DENIED');
    }
    const supportedTypes = metadataOnly ? [0, 5, 10, 11, 12, 15] : [0, 5, 10, 11, 12];
    if (typeof raw.type !== 'number' || !supportedTypes.includes(raw.type)) {
      throw new SafeError('SCOPE_DENIED');
    }
    const result: ChannelSummary = {
      id, guildId: raw.guild_id, name: shortText(raw.name ?? '', 100), type: raw.type,
      readable: raw.type !== 15,
    };
    if ([10, 11, 12].includes(raw.type)) {
      const parentId = raw.parent_id;
      if (!validId(parentId) || !this.config.channelIds.has(parentId)) throw new SafeError('SCOPE_DENIED');
      const parent = asRecord(await this.request('GET', `/channels/${parentId}`, deadline, undefined, signal));
      if (parent.id !== parentId || parent.guild_id !== raw.guild_id || ![0, 5, 15].includes(parent.type as number)) {
        throw new SafeError('SCOPE_DENIED');
      }
      result.parentId = parentId;
    }
    return result;
  }

  /** Bound queue wait plus all HTTP attempts under one operation deadline. */
  private async serialized<T>(work: (deadline: number) => Promise<T>, signal?: AbortSignal): Promise<T> {
    this.requireActive(signal);
    if (this.pending >= MAX_PENDING_OPERATIONS) throw new SafeError('BUSY');
    const deadline = this.now() + OPERATION_DEADLINE_MS;
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    this.pending++;
    let acquired = false;
    try {
      await this.bound(previous, deadline, 'DEADLINE_EXCEEDED', signal);
      acquired = true;
      this.pending--;
      this.requireActive(signal);
      // Every network and backoff await has the same deadline. Let it settle
      // before releasing the slot so a timed-out task cannot overlap its peer.
      return await work(deadline);
    } finally {
      if (acquired) release();
      else { this.pending--; void previous.then(release); }
    }
  }

  /** Race an awaited task against its fixed deadline without leaking errors. */
  private async bound<T>(task: Promise<T>, deadline: number, code: SafeErrorCode, signal?: AbortSignal): Promise<T> {
    this.requireActive(signal);
    const remaining = deadline - this.now();
    if (remaining <= 0) throw new SafeError(code);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      const candidates: Promise<T>[] = [task, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SafeError(code)), remaining);
      })];
      if (signal) candidates.push(new Promise<never>((_, reject) => {
        onAbort = () => reject(new SafeError('CANCELLED'));
        signal.addEventListener('abort', onAbort, { once: true });
        // Abort can race with listener registration after the initial check.
        if (signal.aborted) onAbort();
      }));
      return await Promise.race(candidates);
    } finally {
      if (timer) clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    }
  }

  /** The last pre-dispatch check prevents queued, cancelled writes. */
  private requireActive(signal?: AbortSignal): void {
    if (signal?.aborted) throw new SafeError('CANCELLED');
  }

  /** Make a fixed-route request with bounded retries for GET only. */
  private async request(method: 'GET' | 'POST', path: string, deadline: number, body?: unknown,
    signal?: AbortSignal): Promise<unknown> {
    this.requireActive(signal);
    if (this.credentialRejected) throw new SafeError('AUTHENTICATION_FAILED');
    const cleanPath = path.split('?')[0] ?? path;
    const major = majorResource(cleanPath);
    const route = routeKey(method, cleanPath);
    const attempts = method === 'GET' ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      await this.waitForPermit(route, major, deadline, signal);
      let response: Response;
      let attemptDeadline: number;
      try {
        ({ response, attemptDeadline } = await this.httpAttempt(method, path, body, deadline, signal));
      } catch (error) {
        if (method === 'POST') {
          if (error instanceof SafeError && error.code === 'CANCELLED') throw error;
          throw new SafeError('WRITE_OUTCOME_UNKNOWN');
        }
        if (error instanceof SafeError && (error.code === 'DEADLINE_EXCEEDED' || error.code === 'CANCELLED')) throw error;
        if (attempt + 1 >= attempts) throw new SafeError('UPSTREAM_FAILURE');
        await this.backoff(attempt, deadline, signal);
        continue;
      }
      this.recordRateHeaders(response, route, major);
      if (response.status === 401) {
        this.credentialRejected = true;
        void response.body?.cancel();
        throw new SafeError('AUTHENTICATION_FAILED');
      }
      if (response.status === 403 || response.status === 404) {
        this.deniedUntil.set(major, this.now() + DENIAL_COOLDOWN_MS);
        void response.body?.cancel();
        throw new SafeError('ACCESS_UNAVAILABLE');
      }
      if (response.status === 429) {
        await this.recordRateLimit(response, route, major, attemptDeadline, signal);
        if (method === 'POST' || attempt + 1 >= attempts) throw new SafeError('RATE_LIMITED');
        continue;
      }
      if (response.status >= 500) {
        void response.body?.cancel();
        if (method === 'POST') throw new SafeError('WRITE_OUTCOME_UNKNOWN');
        if (attempt + 1 >= attempts) throw new SafeError('UPSTREAM_FAILURE');
        await this.backoff(attempt, deadline, signal);
        continue;
      }
      if (!response.ok || response.redirected || response.status >= 300) {
        void response.body?.cancel();
        throw new SafeError('UPSTREAM_FAILURE');
      }
      try {
        return JSON.parse(await this.readBounded(response, MAX_RESPONSE_BYTES, attemptDeadline, signal));
      } catch (error) {
        if (method === 'POST') throw new SafeError('WRITE_OUTCOME_UNKNOWN');
        if (error instanceof SafeError && (error.code === 'DEADLINE_EXCEEDED' || error.code === 'CANCELLED')) throw error;
        if (error instanceof SafeError) throw error;
        throw new SafeError('UPSTREAM_FAILURE');
      }
    }
    throw new SafeError('UPSTREAM_FAILURE');
  }

  /** Enforce an attempt timeout across fetch and streaming response consumption. */
  private async httpAttempt(method: 'GET' | 'POST', path: string, body: unknown, deadline: number,
    signal?: AbortSignal):
    Promise<{ response: Response; attemptDeadline: number }> {
    this.requireActive(signal);
    const remaining = Math.min(this.requestTimeoutMs, deadline - this.now());
    if (remaining <= 0) throw new SafeError('DEADLINE_EXCEEDED');
    const attemptDeadline = this.now() + remaining;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    let dispatched = false;
    try {
      const init: RequestInit = {
        method, redirect: 'error', signal: controller.signal,
        headers: {
          Authorization: `Bot ${this.config.botToken}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      };
      const candidates: Promise<Response>[] = [];
      if (signal) candidates.push(new Promise<never>((_, reject) => {
        onAbort = () => {
          controller.abort();
          reject(new SafeError(dispatched && method === 'POST' ? 'WRITE_OUTCOME_UNKNOWN' : 'CANCELLED'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }));
      this.requireActive(signal);
      // This transition is the ambiguous-send boundary: cancellation after
      // fetch invocation cannot establish whether Discord received the POST.
      dispatched = true;
      candidates.push(this.fetcher(`${API_ORIGIN}${path}`, init));
      candidates.push(
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new SafeError('DEADLINE_EXCEEDED')); }, remaining);
        }),
      );
      const response = await Promise.race(candidates);
      return { response, attemptDeadline };
    } catch (error) {
      if (error instanceof SafeError) throw error;
      if (signal?.aborted) throw new SafeError(dispatched && method === 'POST' ? 'WRITE_OUTCOME_UNKNOWN' : 'CANCELLED');
      throw new SafeError('UPSTREAM_FAILURE');
    } finally {
      if (timer) clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    }
  }

  /** Consume at most the configured bytes even when Content-Length is absent. */
  private async readBounded(response: Response, maximum: number, deadline: number, signal?: AbortSignal): Promise<string> {
    if (!response.body) throw new SafeError('UPSTREAM_FAILURE');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await this.bound(reader.read(), deadline, 'DEADLINE_EXCEEDED', signal);
        if (next.done) break;
        size += next.value.byteLength;
        if (size > maximum) throw new SafeError('UPSTREAM_FAILURE');
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (error) {
      if (error instanceof SafeError && (error.code === 'DEADLINE_EXCEEDED' || error.code === 'CANCELLED')) throw error;
      throw new SafeError('UPSTREAM_FAILURE');
    } finally {
      void reader.cancel().catch(() => undefined);
    }
  }

  /** Respect global, bucket and recent denial state before any attempt. */
  private async waitForPermit(route: string, major: string, deadline: number, signal?: AbortSignal): Promise<void> {
    this.requireActive(signal);
    if (this.credentialRejected) throw new SafeError('AUTHENTICATION_FAILED');
    if ((this.deniedUntil.get(major) ?? 0) > this.now()) throw new SafeError('ACCESS_UNAVAILABLE');
    const bucket = this.routeBuckets.get(route);
    const pause = Math.max(this.globalPauseUntil, bucket ? this.bucketPauseUntil.get(`${bucket}:${major}`) ?? 0 : 0);
    const wait = pause - this.now();
    if (wait <= 0) return;
    if (wait >= deadline - this.now()) throw new SafeError('RATE_LIMITED');
    await this.bound(this.sleep(wait), deadline, 'DEADLINE_EXCEEDED', signal);
    // SECURITY: A fake or early-returning sleeper must not bypass Discord's pause.
    if (pause > this.now()) throw new SafeError('RATE_LIMITED');
  }

  /** Learn bucket identity and proactive reset only from bounded numeric headers. */
  private recordRateHeaders(response: Response, route: string, major: string): void {
    const bucket = response.headers.get('x-ratelimit-bucket');
    if (bucket && /^[A-Za-z0-9_-]{1,128}$/.test(bucket)) this.routeBuckets.set(route, bucket);
    const remaining = response.headers.get('x-ratelimit-remaining');
    const rawReset = response.headers.get('x-ratelimit-reset-after');
    const reset = rawReset === null ? NaN : Number(rawReset);
    const mapped = this.routeBuckets.get(route);
    if (remaining === '0' && mapped) {
      const pause = Number.isFinite(reset) && reset >= 0
        ? Math.ceil(reset * 1000) : FALLBACK_RATE_PAUSE_MS;
      const key = `${mapped}:${major}`;
      this.bucketPauseUntil.set(key, Math.max(this.bucketPauseUntil.get(key) ?? 0, this.now() + pause));
    }
  }

  /** Persist 429 timing across operations, even if this call cannot wait. */
  private async recordRateLimit(response: Response, route: string, major: string, deadline: number,
    signal?: AbortSignal): Promise<void> {
    const rawHeader = response.headers.get('retry-after');
    const headerSeconds = rawHeader === null ? NaN : Number(rawHeader);
    let bodySeconds = NaN;
    let global = response.headers.get('x-ratelimit-global') === 'true';
    try {
      const text = await this.readBounded(response, MAX_ERROR_BYTES, deadline, signal);
      const body = asRecord(JSON.parse(text));
      bodySeconds = Number(body.retry_after);
      if (body.global === true) global = true;
    } catch { /* Headers or a fallback pause still protect the scheduler. */ }
    const requiredSeconds = Math.max(
      Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds : 0,
      Number.isFinite(bodySeconds) && bodySeconds > 0 ? bodySeconds : 0,
    );
    const pauseMs = requiredSeconds > 0 ? Math.ceil(requiredSeconds * 1000) : FALLBACK_RATE_PAUSE_MS;
    const until = this.now() + pauseMs;
    if (global) this.globalPauseUntil = Math.max(this.globalPauseUntil, until);
    else {
      const bucket = this.routeBuckets.get(route) ?? route;
      const key = `${bucket}:${major}`;
      this.bucketPauseUntil.set(key, Math.max(this.bucketPauseUntil.get(key) ?? 0, until));
      this.routeBuckets.set(route, bucket);
    }
  }

  /** A short bounded delay absorbs transient GET failures without hot loops. */
  private async backoff(attempt: number, deadline: number, signal?: AbortSignal): Promise<void> {
    const milliseconds = 100 * (2 ** attempt) + Math.floor(Math.random() * 25);
    if (milliseconds >= deadline - this.now()) throw new SafeError('DEADLINE_EXCEEDED');
    await this.bound(this.sleep(milliseconds), deadline, 'DEADLINE_EXCEEDED', signal);
  }
}
