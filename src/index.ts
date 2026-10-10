#!/usr/bin/env node
/**
 * @file Local stdio entrypoint
 * @description Verifies a configured bot identity before exposing Discord tools to the MCP host.
 * @module cli
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DiscordService, loadConfig } from './core.js';
import { createServer } from './server.js';

/** Starts the single-operator process; no credential or raw failure detail reaches diagnostics. */
async function main(): Promise<void> {
  const service = new DiscordService(loadConfig(process.env));
  await service.verifyIdentity();
  const server = createServer(service);
  await server.connect(new StdioServerTransport());
}

main().catch(() => {
  process.stderr.write('Rocking Discord MCP could not start. Check the bot credential, exact allowlists and Discord access.\n');
  process.exitCode = 1;
});
