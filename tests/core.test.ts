/**
 * @file Core security contract tests
 * @description Exercises the Discord connector with an in-memory HTTP peer so
 *   authentication, allowlists, bounded data and write behavior are reviewable
 *   without real credentials or messages.
 * @module tests/core
 * @seeAlso docs/specs/architecture.md
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DiscordService, SafeError, loadConfig } from '../src/core.js';

const GUILD = '12345678901234567';
const CHANNEL = '22345678901234567';
const OTHER_CHANNEL = '32345678901234567';
const MESSAGE = '42345678901234567';

/** Builds a valid operator-owned configuration for isolated tests. */
function config(overrides: Record<string, string | undefined> = {}) {
  return loadConfig({
    DISCORD_BOT_TOKEN: 'test.bot.token',
    DISCORD_GUILD_IDS: GUILD,
    DISCORD_CHANNEL_IDS: CHANNEL,
    ...overrides,
  });
}

/** Creates a JSON response without relying on live Discord behavior. */
function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });
}

/** Supplies ordered fake HTTP responses and keeps every outbound request. */
function peer(...responses: Array<Response | Error | (() => Promise<Response>)>) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fetcher = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    calls.push({ url: new URL(String(input)), init });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (typeof response === 'function') return response();
    assert.ok(response, 'unexpected outbound request');
    return response;
  };
  return { calls, fetcher: fetcher as typeof fetch };
}

test('configuration fails closed and keeps write scope narrower than read scope', () => {
  for (const overrides of [
    { DISCORD_BOT_TOKEN: undefined },
    { DISCORD_GUILD_IDS: '*' },
    { DISCORD_CHANNEL_IDS: '' },
    { DISCORD_ENABLE_WRITES: 'yes' },
    { DISCORD_ENABLE_WRITES: 'true' },
    { DISCORD_ENABLE_WRITES: 'false', DISCORD_WRITE_CHANNEL_IDS: CHANNEL },
    { DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: OTHER_CHANNEL },
  ]) {
    assert.throws(() => config(overrides), SafeError);
  }
  const allowed = config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL });
  assert.equal(allowed.enableWrites, true);
  assert.deepEqual([...allowed.writeChannelIds], [CHANNEL]);
  assert.deepEqual([...config({ DISCORD_ENABLE_WRITES: 'false', DISCORD_WRITE_CHANNEL_IDS: '' }).writeChannelIds], []);
});

test('bot identity is required before channel data and personal accounts are rejected', async () => {
  const fake = peer(json({ id: GUILD, username: 'human', bot: false }));
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  await assert.rejects(service.listGuilds(), (error: unknown) => error instanceof SafeError && error.code === 'AUTHENTICATION_FAILED');
  assert.deepEqual(fake.calls.map(call => call.url.pathname), ['/api/v10/users/@me']);
});

test('authorized channel history uses fresh same-guild metadata and exact allowlist', async () => {
  const fake = peer(
    json({ id: GUILD, username: 'bot', bot: true }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0, name: 'general' }),
    json([{ id: MESSAGE, channel_id: CHANNEL, author: { id: GUILD }, content: 'safe text', timestamp: '2026-10-10T00:00:00.000Z' }]),
  );
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  const result = await service.readMessages({ channelId: CHANNEL });
  assert.deepEqual(fake.calls.map(call => call.url.pathname), [
    '/api/v10/users/@me', `/api/v10/channels/${CHANNEL}`, `/api/v10/channels/${CHANNEL}/messages`,
  ]);
  assert.equal(result.messages[0]?.content, 'safe text');
  assert.equal(result.nextBefore, `${CHANNEL}:${MESSAGE}`);
  assert.equal(result.untrusted, true);
  assert.equal(result.source, 'discord');
  assert.equal(fake.calls[2]?.url.searchParams.get('limit'), '20');
  assert.equal(fake.calls[0]?.init.redirect, 'error');
  assert.equal((fake.calls[0]?.init.headers as Record<string, string>).Authorization, 'Bot test.bot.token');
});

test('unauthorized IDs, DM types, cross-guild channels and revoked metadata fail before history', async () => {
  const service = new DiscordService(config(), { fetch: peer().fetcher });
  await assert.rejects(service.readMessages({ channelId: OTHER_CHANNEL }), SafeError);
  await assert.rejects(service.readMessages({ channelId: '1' }), SafeError);
  for (const metadata of [
    { id: CHANNEL, guild_id: GUILD, type: 1 },
    { id: CHANNEL, guild_id: OTHER_CHANNEL, type: 0 },
    { id: OTHER_CHANNEL, guild_id: GUILD, type: 0 },
  ]) {
    const fake = peer(json({ id: GUILD, bot: true, username: 'bot' }), json(metadata));
    await assert.rejects(new DiscordService(config(), { fetch: fake.fetcher }).readMessages({ channelId: CHANNEL }), SafeError);
    assert.equal(fake.calls.length, 2);
  }
  const revoked = peer(json({ id: GUILD, bot: true, username: 'bot' }), json({ message: 'secret' }, 403));
  await assert.rejects(new DiscordService(config(), { fetch: revoked.fetcher }).readMessages({ channelId: CHANNEL }), SafeError);
  assert.equal(revoked.calls.length, 2);
});

test('thread access requires an explicitly allowed parent with matching live metadata', async () => {
  const disallowed = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 11, parent_id: OTHER_CHANNEL }),
  );
  await assert.rejects(new DiscordService(config(), { fetch: disallowed.fetcher }).readMessages({ channelId: CHANNEL }), SafeError);
  assert.equal(disallowed.calls.length, 2);

  const mismatch = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 11, parent_id: OTHER_CHANNEL }),
    json({ id: OTHER_CHANNEL, guild_id: MESSAGE, type: 0 }),
  );
  await assert.rejects(new DiscordService(config({ DISCORD_CHANNEL_IDS: `${CHANNEL},${OTHER_CHANNEL}` }),
    { fetch: mismatch.fetcher }).readMessages({ channelId: CHANNEL }), SafeError);
  assert.equal(mismatch.calls.length, 3);
});

test('a configured forum parent is metadata-only while its authorized thread is readable', async () => {
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 11, parent_id: OTHER_CHANNEL, name: 'topic' }),
    json({ id: OTHER_CHANNEL, guild_id: GUILD, type: 15, name: 'forum' }),
    json({ id: OTHER_CHANNEL, guild_id: GUILD, type: 15, name: 'forum' }),
  );
  const service = new DiscordService(config({ DISCORD_CHANNEL_IDS: `${CHANNEL},${OTHER_CHANNEL}` }), { fetch: fake.fetcher });
  const result = await service.listChannels(GUILD);
  assert.deepEqual(result.channels.map(channel => [channel.id, channel.readable]), [
    [CHANNEL, true], [OTHER_CHANNEL, false],
  ]);
  assert.equal(result.untrusted, true);
  const forbidden = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: OTHER_CHANNEL, guild_id: GUILD, type: 15 }),
  );
  await assert.rejects(new DiscordService(config({ DISCORD_CHANNEL_IDS: `${CHANNEL},${OTHER_CHANNEL}` }),
    { fetch: forbidden.fetcher }).readMessages({ channelId: OTHER_CHANNEL }), SafeError);
  assert.equal(forbidden.calls.length, 2);
});

test('cursor cannot be reused for a different channel and nested message bodies are dropped', async () => {
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    json([{ id: MESSAGE, channel_id: CHANNEL, author: { id: GUILD }, content: 'visible',
      timestamp: '2026-10-10T00:00:00.000Z', referenced_message: { content: 'nested secret' },
      message_snapshots: [{ message: { content: 'forwarded secret' } }],
    }]),
  );
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  await assert.rejects(service.readMessages({ channelId: CHANNEL, before: `${OTHER_CHANNEL}:${MESSAGE}` }), SafeError);
  assert.equal(fake.calls.length, 0);
  const result = await service.readMessages({ channelId: CHANNEL });
  assert.equal(result.guildId, GUILD);
  assert.doesNotMatch(JSON.stringify(result), /nested secret|forwarded secret/);
});

test('history limits and cursor reflect only returned messages after output truncation', async () => {
  const messages = Array.from({ length: 10 }, (_, index) => ({
    id: String(50000000000000000 - index), channel_id: CHANNEL,
    author: { id: GUILD }, content: 'x'.repeat(5000), timestamp: '2026-10-10T00:00:00.000Z',
  }));
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, parent_id: OTHER_CHANNEL, type: 11 }),
    json({ id: OTHER_CHANNEL, guild_id: GUILD, type: 0 }), json(messages),
  );
  const result = await new DiscordService(config({ DISCORD_CHANNEL_IDS: `${CHANNEL},${OTHER_CHANNEL}` }), { fetch: fake.fetcher }).readMessages({
    channelId: CHANNEL, limit: 10, before: `${CHANNEL}:${MESSAGE}`,
  });
  assert.ok(result.messages.length <= 10);
  assert.ok(result.messages.reduce((sum, message) => sum + message.content.length, 0) <= 32000);
  assert.ok(result.messages.every(message => message.content.length <= 4000));
  assert.equal(result.truncated, true);
  assert.equal(result.nextBefore, `${CHANNEL}:${result.messages.at(-1)?.id}`);
  assert.equal(fake.calls[3]?.url.searchParams.get('before'), MESSAGE);
});

test('oversized bodies and redirects are rejected without exposing upstream text', async () => {
  for (const response of [
    new Response('secret'.repeat(200000)),
    new Response(null, { status: 302, headers: { Location: 'https://evil.example/private' } }),
  ]) {
    const fake = peer(response);
    const error = await new DiscordService(config(), { fetch: fake.fetcher }).verifyIdentity()
      .then(() => null, (reason: unknown) => reason);
    assert.ok(error instanceof SafeError);
    assert.doesNotMatch(String(error), /secret|evil\.example|test\.bot\.token/);
  }
});

test('a hung request has a whole fetch/read deadline', async () => {
  const fake = peer(() => new Promise<Response>(() => {}));
  const service = new DiscordService(config(), { fetch: fake.fetcher, requestTimeoutMs: 20 });
  await assert.rejects(service.verifyIdentity(), (error: unknown) => error instanceof SafeError && error.code === 'DEADLINE_EXCEEDED');
});

test('a hung response stream is bounded by the same HTTP attempt deadline', async () => {
  const stream = new ReadableStream<Uint8Array>({ start() { /* Intentionally never closes. */ } });
  const fake = peer(new Response(stream));
  const service = new DiscordService(config(), { fetch: fake.fetcher, requestTimeoutMs: 20 });
  await assert.rejects(service.verifyIdentity(), (error: unknown) => error instanceof SafeError && error.code === 'DEADLINE_EXCEEDED');
});

test('401 latches all later operations and 403 cools down that channel', async () => {
  const invalid = peer(json({ message: 'credential secret' }, 401));
  const invalidService = new DiscordService(config(), { fetch: invalid.fetcher });
  await assert.rejects(invalidService.verifyIdentity(), SafeError);
  await assert.rejects(invalidService.listGuilds(), SafeError);
  assert.equal(invalid.calls.length, 1);

  const denied = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ message: 'private resource' }, 403),
  );
  const deniedService = new DiscordService(config(), { fetch: denied.fetcher });
  await assert.rejects(deniedService.readMessages({ channelId: CHANNEL }), SafeError);
  await assert.rejects(deniedService.readMessages({ channelId: CHANNEL }), SafeError);
  assert.equal(denied.calls.length, 2);
});

test('a previously readable channel is denied after Discord revokes access', async () => {
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    json([{ id: MESSAGE, channel_id: CHANNEL, author: { id: GUILD }, content: 'first',
      timestamp: '2026-10-10T00:00:00.000Z' }]),
    json({ message: 'no longer allowed' }, 403),
  );
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  assert.equal((await service.readMessages({ channelId: CHANNEL })).messages[0]?.content, 'first');
  await assert.rejects(service.readMessages({ channelId: CHANNEL }), SafeError);
  assert.deepEqual(fake.calls.map(call => call.url.pathname).slice(1), [
    `/api/v10/channels/${CHANNEL}`, `/api/v10/channels/${CHANNEL}/messages`, `/api/v10/channels/${CHANNEL}`,
  ]);
});

test('a long global 429 pause survives the failed call and blocks another route', async () => {
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ retry_after: 60, global: true }, 429),
  );
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  await assert.rejects(service.listGuilds(), (error: unknown) => error instanceof SafeError && error.code === 'RATE_LIMITED');
  await assert.rejects(service.readMessages({ channelId: CHANNEL }),
    (error: unknown) => error instanceof SafeError && error.code === 'RATE_LIMITED');
  assert.equal(fake.calls.length, 2);
});

test('contradictory 429 headers never shorten a bucket reset pause', async () => {
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ retry_after: 0.01 }, 429, {
      'x-ratelimit-bucket': 'bucket1', 'x-ratelimit-remaining': '0',
      'x-ratelimit-reset-after': '60', 'retry-after': '0.01',
    }),
  );
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  await assert.rejects(service.listGuilds(), (error: unknown) => error instanceof SafeError && error.code === 'RATE_LIMITED');
  assert.equal(fake.calls.length, 2);
});

test('queue overflow fails promptly while the single in-flight request is held', async () => {
  let finish!: (response: Response) => void;
  const waiting = new Promise<Response>(resolve => { finish = resolve; });
  const fake = peer(() => waiting);
  const service = new DiscordService(config(), { fetch: fake.fetcher });
  const jobs = Array.from({ length: 20 }, () => service.verifyIdentity());
  await assert.rejects(service.verifyIdentity(), (error: unknown) => error instanceof SafeError && error.code === 'BUSY');
  finish(json({ id: GUILD, bot: true, username: 'bot' }));
  await Promise.all(jobs);
  assert.equal(fake.calls.length, 1);
});

test('cancelling a queued send releases its slot and never dispatches POST', async () => {
  let finish!: (response: Response) => void;
  const waiting = new Promise<Response>(resolve => { finish = resolve; });
  const fake = peer(() => waiting);
  const service = new DiscordService(config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL }),
    { fetch: fake.fetcher });
  const first = service.verifyIdentity();
  const controller = new AbortController();
  const send = service.sendMessage({ channelId: CHANNEL, content: 'hello' }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(send, (error: unknown) => error instanceof SafeError && error.code === 'CANCELLED');
  finish(json({ id: GUILD, bot: true, username: 'bot' }));
  await first;
  assert.equal(fake.calls.length, 1);
});

test('cancelling an in-flight GET stops retries, while cancelled POST has unknown outcome', async () => {
  const readController = new AbortController();
  const readFake = peer(() => new Promise<Response>(() => {}));
  const reader = new DiscordService(config(), { fetch: readFake.fetcher });
  const read = reader.verifyIdentity({ signal: readController.signal });
  readController.abort();
  await assert.rejects(read, (error: unknown) => error instanceof SafeError && error.code === 'CANCELLED');
  assert.ok(readFake.calls.length <= 1);

  const controller = new AbortController();
  const writeFake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    () => new Promise<Response>(() => {}),
  );
  const writer = new DiscordService(config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL }),
    { fetch: writeFake.fetcher });
  const send = writer.sendMessage({ channelId: CHANNEL, content: 'hello' }, { signal: controller.signal });
  while (writeFake.calls.length < 3) await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(send, (error: unknown) => error instanceof SafeError && error.code === 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(writeFake.calls.filter(call => call.init.method === 'POST').length, 1);
});

test('read 429 may retry twice, while a write is never retried', async () => {
  const readFake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ message: 'rate' }, 429, { 'retry-after': '0.01' }),
    json({ message: 'rate' }, 429, { 'retry-after': '0.02' }),
    json({ id: GUILD, name: 'Rocking' }),
  );
  const reader = new DiscordService(config(), { fetch: readFake.fetcher });
  assert.deepEqual(await reader.listGuilds(), {
    guilds: [{ id: GUILD, name: 'Rocking' }], source: 'discord', untrusted: true,
  });
  assert.equal(readFake.calls.length, 4);

  const writeFake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    new Error('secret network failure'),
  );
  const writer = new DiscordService(config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL }), { fetch: writeFake.fetcher });
  await assert.rejects(writer.sendMessage({ channelId: CHANNEL, content: 'hello' }), SafeError);
  assert.equal(writeFake.calls.length, 3);
});

test('an early timer wake waits out the remaining 429 pause before retrying', async () => {
  let clock = 1_000;
  const waits: number[] = [];
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ retry_after: 0.01 }, 429),
    json({ id: GUILD, name: 'Rocking' }),
  );
  const fetcher: typeof fetch = async (input, init) => {
    if (fake.calls.length === 2) assert.equal(clock, 1_010, 'retry must observe the full cooldown');
    return fake.fetcher(input, init);
  };
  const reader = new DiscordService(config(), {
    fetch: fetcher,
    now: () => clock,
    sleep: async milliseconds => {
      waits.push(milliseconds);
      // Model the first timer waking one millisecond before its requested delay.
      clock += waits.length === 1 ? milliseconds - 1 : milliseconds;
    },
  });
  assert.deepEqual((await reader.listGuilds()).guilds, [{ id: GUILD, name: 'Rocking' }]);
  assert.deepEqual(waits, [10, 1]);
  assert.equal(fake.calls.length, 3);
});

test('an inert sleeper cannot bypass a 429 pause or spin indefinitely', async () => {
  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ retry_after: 0.01 }, 429),
  );
  const reader = new DiscordService(config(), {
    fetch: fake.fetcher,
    now: () => 1_000,
    sleep: async () => undefined,
  });
  await assert.rejects(reader.listGuilds(),
    (error: unknown) => error instanceof SafeError && error.code === 'RATE_LIMITED');
  assert.equal(fake.calls.length, 2);
});

test('send validates reply channel and suppresses every mention', async () => {
  const writes = config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL });
  const badReply = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    json({ id: MESSAGE, channel_id: OTHER_CHANNEL }),
  );
  await assert.rejects(new DiscordService(writes, { fetch: badReply.fetcher }).sendMessage({
    channelId: CHANNEL, content: 'hello', replyToMessageId: MESSAGE,
  }), SafeError);
  assert.equal(badReply.calls.length, 3);

  const goodReply = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    json({ id: MESSAGE, channel_id: CHANNEL }),
    json({ id: MESSAGE, channel_id: CHANNEL }),
  );
  const output = await new DiscordService(writes, { fetch: goodReply.fetcher }).sendMessage({
    channelId: CHANNEL, content: '@everyone', replyToMessageId: MESSAGE,
  });
  assert.equal(output.id, MESSAGE);
  const body = JSON.parse(String(goodReply.calls[3]?.init.body));
  assert.deepEqual(body.allowed_mentions, { parse: [], users: [], roles: [], replied_user: false });
  assert.equal(body.flags, 4);
  assert.equal(body.tts, false);
  assert.deepEqual(body.message_reference, { message_id: MESSAGE, channel_id: CHANNEL, fail_if_not_exists: true });
  assert.equal(goodReply.calls[3]?.init.method, 'POST');
});

test('disabled writes make no HTTP request, and an upstream 5xx leaves one unknown send', async () => {
  const readOnly = peer();
  await assert.rejects(new DiscordService(config(), { fetch: readOnly.fetcher }).sendMessage({
    channelId: CHANNEL, content: 'hello',
  }), SafeError);
  assert.equal(readOnly.calls.length, 0);

  const fake = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    json({ message: 'maybe delivered' }, 503),
  );
  const service = new DiscordService(config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL }),
    { fetch: fake.fetcher });
  await assert.rejects(service.sendMessage({ channelId: CHANNEL, content: 'hello' }),
    (error: unknown) => error instanceof SafeError && error.code === 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(fake.calls.filter(call => call.init.method === 'POST').length, 1);

  const malformed = peer(
    json({ id: GUILD, bot: true, username: 'bot' }),
    json({ id: CHANNEL, guild_id: GUILD, type: 0 }),
    json([]),
  );
  await assert.rejects(new DiscordService(config({ DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: CHANNEL }),
    { fetch: malformed.fetcher }).sendMessage({ channelId: CHANNEL, content: 'hello' }),
  (error: unknown) => error instanceof SafeError && error.code === 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(malformed.calls.filter(call => call.init.method === 'POST').length, 1);
});
