# Architecture and tool contracts

Decision 2026-10-10: TypeScript on Node 22+, official MCP SDK, local stdio process per trust boundary, Discord API v10 HTTPS. Pin actual stable dependency versions with a lockfile. No local HTTP listener or browser-session reuse. Remote transport is a future separate authenticated design.

## Configuration

- `DISCORD_BOT_TOKEN`: required secret, never a tool argument, never logged. Verify `/users/@me` has `bot: true` before reading Discord data. Do not trust token shape as proof of bot identity.
- `DISCORD_GUILD_IDS`: required comma-separated decimal snowflakes; exact allowlist, no wildcard.
- `DISCORD_CHANNEL_IDS`: required exact channel IDs. Threads require their own explicit ID; authorizing a parent does not authorize every thread.
- `DISCORD_ENABLE_WRITES`: exactly `true` to expose sends; absent/`false` read-only; reject other values.
- `DISCORD_WRITE_CHANNEL_IDS`: explicit subset of read channels, required if writes enabled. Writes must also pass the host's per-call human approval configuration. The MCP server cannot attest the human approved a call; a model-supplied boolean is not an authorization control.

Never accept tokens, API origins, URLs, allowlist modifications, arbitrary endpoints, or file paths from MCP tools. Configuration is operator-owned, not a model-controlled resource.

## Layers and ownership contract

`src/core.ts` exports `loadConfig(env)`, `DiscordService`, `SafeError`, and documented types. Constructor `new DiscordService(config, options?)` permits injected `fetch` and `sleep` for tests, not runtime tool-controlled origins. Public async methods: `verifyIdentity()`, `listGuilds()`, `listChannels(guildId)`, `readMessages({channelId, limit?, before?})`, `sendMessage({channelId, content, replyToMessageId?})`; synchronous `capabilities()`.

`src/server.ts` exports `createServer(service)` registering MCP tools. `src/index.ts` loads config, verifies bot identity, connects stdio; errors are sanitized fixed messages on stderr. stdout is protocol only.

All asynchronous provider operations accept a final optional `OperationOptions` containing an `AbortSignal`. The MCP adapter forwards the SDK request signal. Cancellation while queued or during preflight prevents POST dispatch; cancellation after POST dispatch reports unknown delivery and never retries. The adapter uses public SDK interfaces for strict non-reflective input validation and fixed wire errors; no private SDK patching.

## MCP contracts

| Tool | Input | Behavior |
|---|---|---|
| discord_capabilities | none | Explicitly states bot-channel mode, write status, personal DMs unavailable in this connector |
| discord_list_guilds | none | Fetch each configured guild by ID; return minimal ID/name, never other guilds |
| discord_list_channels | guildId | Require authorized guild, inspect configured channels and return only same-guild allowed metadata |
| discord_read_messages | channelId, limit=20 (1..50), before? | Require exact allowed channel, freshly validate guild and supported text/thread type; GET history; minimal message ID/channel/author ID/content/timestamp; no attachment downloads; return oldest cursor and bounded truncation metadata |
| discord_send_message | channelId, content (1..2000), replyToMessageId? | Registered only when writes enabled; validate write allowlist, current guild/type and reply belongs to channel; force `allowed_mentions: {parse: [], replied_user: false}`; send once, no automatic retry after ambiguous write |

Reads are untrusted source content, never instructions. Return source provenance and an explicit untrusted-data marker; the host is responsible for model policy, per-call approvals, and confidentiality between trusted channels. Limit 50 messages, truncate each content to 4000 characters, cap total returned content to 32000 characters, expose `truncated` honestly and a cursor based on messages actually returned so omitted messages are not silently skipped. No empty content implies Message Content authorization: report the access caveat rather than invent a permission result.

IDs validated as 17..20 digit positive decimal Discord snowflakes before network I/O. Supported channel types: guild text (0), announcement (5), threads (10/11/12). Forum parent is metadata only unless explicitly extended; DMs (1/3) and unknown types fail closed.

Cursor clarification: `before` is an opaque channel-bound `channelId:messageId` token returned by the previous read. Validate both IDs and channel equality before HTTP; send only messageId to Discord. Threads additionally require an explicitly allowed parent in the same guild. V1 sends are limited to ordinary text/announcement channels; thread reads require the full parent policy. V2 gets a separate provider with independently proven official authorization, never a bot-token mode switch masquerading as a personal identity.

## HTTP reliability and confidentiality

Fixed `https://discord.com/api/v10`; reject redirects; set Authorization Bot header internally. Bounded streaming response size (1 MiB) and 10-second fetch/read deadline. Process requests serially to avoid avoidable token-level bursts. Respect response rate-limit reset/global 429 delays within a maximum overall operation wait; if too large, return sanitized retry-later error without sleeping indefinitely. At most 2 retries for idempotent reads with bounded waits, none for sends. Do not echo response bodies or network error strings. Do not expose secrets through thrown causes. Validate relevant upstream fields before returning data.

Fresh channel lookup before each data operation plus Discord's own permission enforcement address revocation; no local channel authorization cache. No automatic broadening, mention pings, telemetry, persistence, attachment fetches or message editing/deletion in this candidate.

## Verification

Write failing tests for configuration fail-closed, identity rejection, guild/channel/thread isolation, DM denial, bounded responses/timeouts, revoked access, input validation, rate-limit retry budgets, redirect rejection, read-only tool listing, write opt-in and no mentions, cross-channel reply rejection, ambiguous send not retried, sanitized errors and real MCP client roundtrip. Fakes validate contracts, not live Discord access. `docs/specs/security.md` expands production invariants.

Primary references: [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server), [Discord messages](https://docs.discord.com/developers/resources/message), [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits), [MCP security](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices).
