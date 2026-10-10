/**
 * @file Distribution allowlist verification
 * @description Fails CI if npm would ship files outside the documented package surface.
 * @module scripts/release
 * @see docs/release-checklist.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Uses npm's own inventory instead of inferring its publish behavior from Git ignore rules. */
function verifyPackage() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this check through npm.');
  const output = execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const packages = JSON.parse(output);
  if (!Array.isArray(packages) || packages.length !== 1) throw new Error('Invalid package inventory.');
  const inventory = packages[0];
  const allowed = /^(?:package\.json|LICENSE|README\.md|SECURITY\.md|docs\/setup\.md|docs\/specs\/[a-z0-9-]+\.md|dist\/src\/(?:core|index|server|measurement)\.(?:js|d\.ts))$/;
  const paths = inventory.files.map(file => file.path);
  if (paths.some(path => typeof path !== 'string' || !allowed.test(path))) throw new Error('Unexpected shipped file.');
  for (const required of ['package.json', 'LICENSE', 'README.md', 'SECURITY.md', 'dist/src/index.js', 'dist/src/core.js', 'dist/src/server.js']) {
    if (!paths.includes(required)) throw new Error('Required distributed file is missing.');
  }
  if (!readFileSync('dist/src/index.js', 'utf8').startsWith('#!/usr/bin/env node')) throw new Error('CLI entrypoint is invalid.');
  return { package: inventory.name, version: inventory.version, shippedFiles: paths.length, inventoryVerified: true };
}

try { console.log(JSON.stringify(verifyPackage())); }
catch {
  // Report the category only: child-process output can contain environment-specific paths.
  console.error('Package inventory verification failed. Build first and inspect npm pack --dry-run locally.');
  process.exitCode = 1;
}
