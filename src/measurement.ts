/**
 * @file Offline aggregate KPI analyzer
 * @description Validates human-supplied totals and derives cautious launch indicators without telemetry.
 * @module measurement
 * @seeAlso docs/specs/measurement.md
 * @architecture Pure functions; callers own consent, aggregation, and storage outside this module.
 */

/** A rate carries its observed denominator or a reason it cannot be measured. */
export type RateResult =
  | { status: 'observed'; numerator: number; denominator: number; rate: number }
  | { status: 'zero_denominator'; numerator: 0; denominator: 0 }
  | { status: 'unavailable' };

/** Supported indicators. Each corresponds to a distinct, documented denominator. */
export type MetricName = 'clickThrough' | 'activation' | 'taskSuccess' | 'retention7d' | 'contributionAcceptance';

/** Validated aggregate report; it contains no rows or individual identifiers. */
export interface Analysis {
  version: 1;
  window: '7d' | '30d';
  start: string;
  end: string;
  source: 'x-native' | 'github' | 'opt-in' | 'test-suite' | 'mixed';
  releaseVersion: string;
  metrics: Record<MetricName, RateResult>;
  /** Externally calculated aggregate, when backed by at least one reported install. */
  medianSetupMinutes?: number;
  /** Coverage cautions and exploratory sample-size hints, never adoption claims. */
  warnings: string[];
}

/** Comparison reports percentage-point change only when both rates were observed. */
export interface Comparison {
  before: Analysis;
  after: Analysis;
  deltas: Record<MetricName, { status: 'observed'; percentagePoints: number } | { status: 'unavailable' }>;
}

const metadata = ['version', 'window', 'start', 'end', 'source', 'releaseVersion'] as const;
const counts = ['impressions', 'outboundClicks', 'installReports', 'activatedInstalls',
  'consentedAttempts', 'successes', 'eligible7d', 'retained7d', 'closedPRs', 'mergedPRs'] as const;
const allowed = new Set<string>([...metadata, ...counts, 'medianSetupMinutes']);
const pairs = {
  clickThrough: ['outboundClicks', 'impressions'],
  activation: ['activatedInstalls', 'installReports'],
  taskSuccess: ['successes', 'consentedAttempts'],
  retention7d: ['retained7d', 'eligible7d'],
  contributionAcceptance: ['mergedPRs', 'closedPRs'],
} as const satisfies Record<MetricName, readonly [typeof counts[number], typeof counts[number]]>;
const names = Object.keys(pairs) as MetricName[];

/** Require a plain record to avoid interpreting arrays, dates, or custom accessors as measurements. */
function record(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) {
    throw new TypeError('Snapshot must be a plain object');
  }
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string') throw new TypeError('Unsupported symbol field');
    // Unknown field names can themselves carry private content, so diagnostics stay fixed.
    if (!allowed.has(key)) throw new TypeError('Unsupported field');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor?.get || descriptor?.set) {
      throw new TypeError('Accessor field rejected');
    }
  }
  return input as Record<string, unknown>;
}

/** Parse strict UTC dates; Date.parse alone normalizes impossible calendar dates. */
function utcDay(value: unknown, field: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${field} must be a UTC calendar date`);
  }
  const day = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${field} must be a valid UTC calendar date`);
  }
  return day;
}

/**
 * Analyze one supplied aggregate observation window.
 * @param input - Plain object following docs/specs/measurement.md; no personal or event data.
 * @returns Validated coverage and rates, including reasons for unknown metrics.
 * @throws {TypeError} When metadata, privacy allowlist, counts, or subset bounds are invalid.
 */
export function analyzeSnapshot(input: unknown): Analysis {
  const data = record(input);
  if (data.version !== 1) throw new TypeError('Unsupported snapshot version');
  if (data.window !== '7d' && data.window !== '30d') throw new TypeError('Unsupported window');
  const start = utcDay(data.start, 'start');
  const end = utcDay(data.end, 'end');
  const days = data.window === '7d' ? 7 : 30;
  if ((end - start) / 86_400_000 !== days) throw new TypeError('Dates must match window length');
  if (!['x-native', 'github', 'opt-in', 'test-suite', 'mixed'].includes(data.source as string)) {
    throw new TypeError('Unsupported source');
  }
  if (typeof data.releaseVersion !== 'string' || data.releaseVersion.length < 1 ||
      data.releaseVersion.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(data.releaseVersion)) {
    throw new TypeError('Invalid releaseVersion');
  }
  for (const key of counts) {
    const value = data[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) {
      throw new TypeError(`${key} must be a nonnegative safe integer`);
    }
  }
  const warnings: string[] = [];
  if (data.source === 'mixed') warnings.push('mixed_source:metric_provenance_unavailable');
  const metrics = {} as Record<MetricName, RateResult>;
  for (const name of names) {
    const [numeratorKey, denominatorKey] = pairs[name];
    const numerator = data[numeratorKey] as number | undefined;
    const denominator = data[denominatorKey] as number | undefined;
    if ((numerator === undefined) !== (denominator === undefined)) {
      throw new TypeError(`${name} requires a complete pair`);
    }
    if (numerator === undefined || denominator === undefined) {
      metrics[name] = { status: 'unavailable' };
      warnings.push(`unavailable:${name}`);
    } else if (numerator > denominator) {
      throw new TypeError(`${numeratorKey} cannot exceed ${denominatorKey}`);
    } else if (denominator === 0) {
      metrics[name] = { status: 'zero_denominator', numerator: 0, denominator: 0 };
      warnings.push(`zero_denominator:${name}`);
    } else {
      metrics[name] = { status: 'observed', numerator, denominator, rate: numerator / denominator };
      // This is a planning caution, not a confidence interval or pass/fail threshold.
      if (denominator < 10) warnings.push(`small_sample:${name}`);
    }
  }
  const median = data.medianSetupMinutes;
  if (median !== undefined && (typeof median !== 'number' || !Number.isFinite(median) || median < 0)) {
    throw new TypeError('medianSetupMinutes must be a finite nonnegative number');
  }
  if (median !== undefined && !(typeof data.installReports === 'number' && data.installReports > 0)) {
    throw new TypeError('medianSetupMinutes requires installReports > 0');
  }
  return {
    version: 1, window: data.window, start: data.start as string, end: data.end as string,
    source: data.source as Analysis['source'], releaseVersion: data.releaseVersion,
    metrics, ...(median === undefined ? {} : { medianSetupMinutes: median as number }), warnings,
  };
}

/**
 * Compare sequential aggregate windows from one release cohort and source.
 * @param before - Earlier validated observation input.
 * @param after - Later observation input with the same source, release, and window.
 * @returns Percentage-point differences where both denominators were observed.
 * @throws {TypeError} When either input is invalid or windows are not comparable.
 */
export function compareSnapshots(before: unknown, after: unknown): Comparison {
  const left = analyzeSnapshot(before);
  const right = analyzeSnapshot(after);
  for (const field of ['window', 'source', 'releaseVersion'] as const) {
    if (left[field] !== right[field]) throw new TypeError(`Comparisons require the same ${field}`);
  }
  if (left.end > right.start) throw new TypeError('Comparisons require chronological nonoverlapping windows');
  const deltas = {} as Comparison['deltas'];
  for (const name of names) {
    const a = left.metrics[name];
    const b = right.metrics[name];
    deltas[name] = a.status === 'observed' && b.status === 'observed'
      ? { status: 'observed', percentagePoints: (b.rate - a.rate) * 100 }
      : { status: 'unavailable' };
  }
  return { before: left, after: right, deltas };
}
