/**
 * @file Offline measurement contract tests
 * @description Checks denominator integrity and privacy boundaries for human-supplied aggregates.
 * @module tests/measurement
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSnapshot, compareSnapshots } from '../src/measurement.js';
import type { RateResult } from '../src/measurement.js';

/** Fail clearly when a fixture unexpectedly lacks a measurable denominator. */
function observedRate(metric: RateResult): number {
  if (metric.status !== 'observed') throw new Error(`Expected observed rate, got ${metric.status}`);
  return metric.rate;
}

const base = {
  version: 1, window: '7d', start: '2026-10-01', end: '2026-10-08',
  source: 'opt-in', releaseVersion: '0.1.0-alpha.1',
};

test('unavailable, zero denominator and observed zero are distinct', () => {
  const absent = analyzeSnapshot(base);
  assert.deepEqual(absent.metrics.activation, { status: 'unavailable' });
  const empty = analyzeSnapshot({ ...base, installReports: 0, activatedInstalls: 0 });
  assert.deepEqual(empty.metrics.activation, { status: 'zero_denominator', numerator: 0, denominator: 0 });
  const observed = analyzeSnapshot({ ...base, installReports: 12, activatedInstalls: 0 });
  assert.deepEqual(observed.metrics.activation, { status: 'observed', numerator: 0, denominator: 12, rate: 0 });
});

test('calculates only supplied aggregates with explicit denominator and small sample warning', () => {
  const result = analyzeSnapshot({ ...base, impressions: 20, outboundClicks: 2,
    installReports: 5, activatedInstalls: 3, consentedAttempts: 4, successes: 3,
    eligible7d: 2, retained7d: 1, closedPRs: 10, mergedPRs: 4,
    medianSetupMinutes: 8.5 });
  assert.equal(result.metrics.clickThrough.status, 'observed');
  assert.equal(observedRate(result.metrics.clickThrough), 0.1);
  assert.equal(observedRate(result.metrics.activation), 0.6);
  assert.equal(observedRate(result.metrics.taskSuccess), 0.75);
  assert.equal(observedRate(result.metrics.retention7d), 0.5);
  assert.equal(observedRate(result.metrics.contributionAcceptance), 0.4);
  assert.equal(result.medianSetupMinutes, 8.5);
  assert.ok(result.warnings.includes('small_sample:activation'));
  assert.ok(result.warnings.includes('small_sample:retention7d'));
});

test('rejects private event payloads, identifiers and unsupported keys instead of ignoring them', () => {
  for (const extra of [{ eventBody: 'private' }, { discordUserId: '123' },
    { events: [{ id: 1 }] }, { message: 'secret' }, { utmContent: 'person' }]) {
    assert.throws(() => analyzeSnapshot({ ...base, ...extra }), /Unsupported field/);
  }
  assert.throws(() => analyzeSnapshot(Object.defineProperty({ ...base }, 'message', { value: 'private' })), /Unsupported field/);
  assert.throws(() => analyzeSnapshot({ ...base, [Symbol('message')]: 'private' }), /Unsupported symbol field/);
  assert.throws(() => analyzeSnapshot({ ...base, 'private-message-body': 1 }), (error: unknown) =>
    error instanceof TypeError && error.message === 'Unsupported field');
});

test('rejects partial, impossible, unsafe and malformed observations', () => {
  assert.throws(() => analyzeSnapshot({ ...base, impressions: 10 }), /pair/);
  assert.throws(() => analyzeSnapshot({ ...base, impressions: 2, outboundClicks: 3 }), /exceed/);
  assert.throws(() => analyzeSnapshot({ ...base, consentedAttempts: 1, successes: 2 }), /exceed/);
  assert.throws(() => analyzeSnapshot({ ...base, closedPRs: -1, mergedPRs: 0 }), /nonnegative safe integer/);
  assert.throws(() => analyzeSnapshot({ ...base, eligible7d: Number.MAX_SAFE_INTEGER + 1, retained7d: 0 }), /nonnegative safe integer/);
  assert.throws(() => analyzeSnapshot({ ...base, medianSetupMinutes: 3 }), /installReports/);
  assert.throws(() => analyzeSnapshot({ ...base, end: '2026-10-09' }), /window/);
});

test('compares only matching, sequential release cohorts and observed denominators', () => {
  const first = { ...base, impressions: 100, outboundClicks: 10 };
  const next = { ...base, start: '2026-10-08', end: '2026-10-15', impressions: 100, outboundClicks: 20 };
  const comparison = compareSnapshots(first, next);
  assert.equal(comparison.deltas.clickThrough.status, 'observed');
  assert.equal(comparison.deltas.clickThrough.percentagePoints, 10);
  assert.deepEqual(comparison.deltas.activation, { status: 'unavailable' });
  assert.throws(() => compareSnapshots(first, { ...next, releaseVersion: '0.2.0' }), /same releaseVersion/);
  assert.throws(() => compareSnapshots(first, { ...next, source: 'github' }), /same source/);
  assert.throws(() => compareSnapshots(first, { ...next, start: '2026-10-07', end: '2026-10-14' }), /nonoverlapping/);
});
