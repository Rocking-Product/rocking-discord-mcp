/**
 * @file Offline measurement CLI
 * @description Analyze operator-supplied aggregate JSON without collecting or persisting data.
 * @module scripts/measure
 * @seeAlso docs/specs/measurement.md
 */
import { open } from 'node:fs/promises';
import { analyzeSnapshot, compareSnapshots } from '../dist/src/measurement.js';

const MAX_BYTES = 64 * 1024; // Aggregate snapshots need no event rows or large payloads.

/**
 * Read a bounded regular file through one handle, including protection against growth.
 * @param {string} path - Operator-selected local aggregate JSON file.
 * @returns {Promise<unknown>} Parsed input for strict contract validation.
 */
async function readSnapshot(path) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Invalid input');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > MAX_BYTES) throw new Error('Invalid input');
    return JSON.parse(buffer.subarray(0, length).toString('utf8'));
  } finally {
    await handle.close();
  }
}

try {
  const paths = process.argv.slice(2);
  if (paths.length < 1 || paths.length > 2) throw new Error('Invalid arguments');
  const before = await readSnapshot(paths[0]);
  const result = paths.length === 1
    ? analyzeSnapshot(before)
    : compareSnapshots(before, await readSnapshot(paths[1]));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch {
  // Filenames, JSON parser errors and unknown keys can contain sensitive text.
  process.stderr.write('Measurement rejected. Use one or two aggregate JSON files following docs/specs/measurement.md (maximum 64 KiB each).\n');
  process.exitCode = 1;
}
