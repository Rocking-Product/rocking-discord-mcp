/**
 * @file MCP protocol acceptance tests
 * @description Exercises actual SDK client/server negotiation and strict tool boundaries without Discord credentials.
 * @module tests/server
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type DiscordPort } from '../src/server.js';
import { DiscordService, loadConfig } from '../src/core.js';

/** Synthetic provider isolates MCP protocol behavior from Discord transport contracts. */
function fixture(writes = false): { service: DiscordPort; calls: string[] } {
  const calls: string[] = [];
  return { calls, service: {
    capabilities: () => ({ mode: 'bot-channels', writesEnabled: writes, personalDmsAvailable: false }),
    listGuilds: async () => ({ guilds: [] }),
    listChannels: async () => ({ channels: [] }),
    readMessages: async () => { calls.push('read'); return { messages: [], untrusted: true }; },
    sendMessage: async () => { calls.push('send'); return { id: '123456789012345678', channelId: '123456789012345679' }; },
  } };
}

/** Connect both real SDK peers and guarantee cleanup even on assertion failures. */
async function withClient(service: DiscordPort, run: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(service);
  const client = new Client({ name: 'rocking-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try { await run(client); } finally { await client.close(); await server.close(); }
}

test('read-only negotiation exposes four read tools and denies hidden sends', async () => {
  const { service, calls } = fixture();
  await withClient(service, async client => {
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 4);
    assert.ok(listed.tools.every(tool => tool.annotations?.readOnlyHint === true));
    assert.ok(!listed.tools.some(tool => tool.name === 'discord_send_message'));
    const result = await client.callTool({ name: 'discord_send_message', arguments: { channelId: '123456789012345679', content: 'test' } });
    assert.equal(result.isError, true);
    assert.deepEqual(calls, []);
  });
});

test('strict input rejects arbitrary destination overrides before provider dispatch', async () => {
  const { service, calls } = fixture();
  await withClient(service, async client => {
    for (const args of [
      { channelId: 'https://example.invalid/' },
      { channelId: '123456789012345679', limit: 51 },
      { channelId: '123456789012345679', apiUrl: 'https://example.invalid/' },
    ]) {
      const result = await client.callTool({ name: 'discord_read_messages', arguments: args });
      assert.equal(result.isError, true);
    }
    assert.deepEqual(calls, []);
  });
});

test('enabled send advertises non-idempotency and strict bounded plain text', async () => {
  const { service, calls } = fixture(true);
  await withClient(service, async client => {
    const tools = await client.listTools();
    const send = tools.tools.find(tool => tool.name === 'discord_send_message');
    assert.equal(send?.annotations?.readOnlyHint, false);
    assert.equal(send?.annotations?.idempotentHint, false);
    const bad = await client.callTool({ name: 'discord_send_message', arguments: { channelId: '123456789012345679', content: 'x'.repeat(2001) } });
    assert.equal(bad.isError, true);
    const ok = await client.callTool({ name: 'discord_send_message', arguments: { channelId: '123456789012345679', content: 'synthetic' } });
    assert.notEqual(ok.isError, true);
    assert.deepEqual(calls, ['send']);
  });
});

test('unexpected provider errors never expose error bodies or credential-like values', async () => {
  const { service } = fixture();
  service.listGuilds = async () => { throw new Error('SECRET_SEEDED_SENTINEL'); };
  await withClient(service, async client => {
    const result = await client.callTool({ name: 'discord_list_guilds', arguments: {} });
    assert.equal(result.isError, true);
    assert.ok(!JSON.stringify(result).includes('SECRET_SEEDED_SENTINEL'));
  });
});

test('capability report explicitly preserves the unresolved personal inbox requirement', async () => {
  await withClient(fixture().service, async client => {
    const result = await client.callTool({ name: 'discord_capabilities', arguments: {} });
    assert.ok(JSON.stringify(result).includes('personalDmsAvailable'));
    assert.ok(JSON.stringify(result).includes('false'));
  });
});

test('SDK validation and unknown tools never reflect giant sensitive input keys', async () => {
  await withClient(fixture().service, async client => {
    const sentinel = 'SEEDED_SENSITIVE_KEY_' + 'x'.repeat(300_000);
    for (const request of [
      { name: 'discord_capabilities', arguments: { [sentinel]: true } },
      { name: sentinel, arguments: {} },
    ]) {
      const result = await client.callTool(request);
      assert.equal(result.isError, true);
      assert.ok(!JSON.stringify(result).includes('SEEDED_SENSITIVE_KEY_'));
      assert.ok(Buffer.byteLength(JSON.stringify(result)) < 1024);
    }
  });
});

test('a real MCP cancellation prevents an already queued Discord send', async () => {
  const guild = '123456789012345678';
  const channel = '123456789012345679';
  let releaseRead!: () => void;
  let enteredRead!: () => void;
  const held = new Promise<void>(resolve => { releaseRead = resolve; });
  const entered = new Promise<void>(resolve => { enteredRead = resolve; });
  let posts = 0;
  const service = new DiscordService(loadConfig({
    DISCORD_BOT_TOKEN: 'synthetic-test-token', DISCORD_GUILD_IDS: guild,
    DISCORD_CHANNEL_IDS: channel, DISCORD_ENABLE_WRITES: 'true', DISCORD_WRITE_CHANNEL_IDS: channel,
  }), { fetch: async (input, init) => {
    const path = String(input);
    if (path.endsWith('/users/@me')) return Response.json({ id: guild, username: 'synthetic', bot: true });
    if (path.endsWith(`/guilds/${guild}`)) { enteredRead(); await held; return Response.json({ id: guild, name: 'synthetic' }); }
    if (init?.method === 'POST') { posts++; return Response.json({ id: '123456789012345680', channel_id: channel }); }
    return Response.json({ id: channel, guild_id: guild, name: 'synthetic', type: 0 });
  } });
  await withClient(service, async client => {
    const read = client.callTool({ name: 'discord_list_guilds', arguments: {} });
    await entered;
    const controller = new AbortController();
    const send = client.callTool({ name: 'discord_send_message', arguments: { channelId: channel, content: 'synthetic' } }, undefined,
      { signal: controller.signal }).catch(() => undefined);
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await send;
    await new Promise(resolve => setImmediate(resolve));
    releaseRead();
    await read;
    // Queue one more operation to prove all earlier work has drained.
    await service.listGuilds();
    assert.equal(posts, 0);
  });
});
