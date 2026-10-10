/**
 * @file Stdio process acceptance
 * @description Starts the actual CLI in a child process with synthetic Discord responses and a real MCP client.
 * @module tests/stdio
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('CLI negotiates over real stdio and returns synthetic history without stdout pollution', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', new URL('./stdio-peer.js', import.meta.url).href,
      fileURLToPath(new URL('../src/index.js', import.meta.url))],
    env: { DISCORD_BOT_TOKEN: 'SYNTHETIC_STDIO_SECRET', DISCORD_GUILD_IDS: '123456789012345678',
      DISCORD_CHANNEL_IDS: '123456789012345679', DISCORD_ENABLE_WRITES: 'false' },
    stderr: 'pipe',
  });
  let diagnostics = '';
  transport.stderr?.on('data', chunk => { diagnostics += String(chunk); });
  const client = new Client({ name: 'stdio-acceptance', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 4);
    const result = await client.callTool({ name: 'discord_read_messages', arguments: { channelId: '123456789012345679', limit: 1 } });
    assert.notEqual(result.isError, true);
    assert.ok(JSON.stringify(result).includes('synthetic subprocess fixture'));
    assert.ok(!JSON.stringify(result).includes('SYNTHETIC_STDIO_SECRET'));
    assert.equal(diagnostics, '');
  } finally { await client.close(); await transport.close(); }
});
