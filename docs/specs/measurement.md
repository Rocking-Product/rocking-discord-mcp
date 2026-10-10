# Offline KPI measurement contract

Status: analysis contract, not observed adoption or a release claim. This module analyzes aggregate snapshots supplied by a human or a separate consented process. It performs no collection, storage, network calls, or runtime instrumentation. It must never receive Discord identifiers, people, messages, individual rows, or event bodies.

## Input and provenance

`analyzeSnapshot(input)` accepts a plain object with exactly these metadata fields: `version: 1`, `window: "7d" | "30d"`, `start` and `end` as UTC calendar dates (`YYYY-MM-DD`, end exclusive), `source: "x-native" | "github" | "opt-in" | "test-suite" | "mixed"`, and `releaseVersion` as a release label containing only ASCII letters, digits, dot and hyphen. Windows must span exactly 7 or 30 UTC days. `source` identifies the aggregate extraction, not a person or a Discord resource. A `mixed` source requires care in interpretation because metric-level provenance is unavailable.

The only optional values are nonnegative safe integer aggregate counts: `impressions`, `outboundClicks`, `installReports`, `activatedInstalls`, `consentedAttempts`, `successes`, `eligible7d`, `retained7d`, `closedPRs`, `mergedPRs`, and `medianSetupMinutes` (finite nonnegative number). The median is an already computed aggregate, not samples or rows. Pairs must be supplied together. An omitted pair is unavailable; an observed pair with a zero denominator is also unknown. Inputs with extra fields or invalid types are rejected before any calculation. In particular, do not pass UTM content, user IDs, Discord IDs, message bodies, raw timestamps, or arrays.

## Rates and coverage

| Output | Numerator / denominator | Interpretation |
| --- | --- | --- |
| `clickThrough` | `outboundClicks / impressions` | Post link interest; impressions are not unique people. |
| `activation` | `activatedInstalls / installReports` | Completion among voluntarily reported installs. Clones/downloads cannot replace reports. |
| `taskSuccess` | `successes / consentedAttempts` | Success among consented supported attempts; untested cases are excluded. |
| `retention7d` | `retained7d / eligible7d` | Consented aggregate cohort eligible for a 7-day follow-up, not all downloads. |
| `contributionAcceptance` | `mergedPRs / closedPRs` | Open PRs are outside the denominator. |

Each observed rate includes numerator and denominator. A missing pair yields `unavailable`; zero denominator yields `zero_denominator`. Neither returns a numeric rate. A reported zero numerator with a positive denominator is an observed zero. A subset count greater than its denominator is invalid. Rates with denominators below 10 receive an exploratory `small_sample` warning, not a statistical verdict. A median may be returned only with `installReports > 0`; it remains an externally computed summary, without invented precision or sample rows.

`compareSnapshots(before, after)` analyzes both snapshots and reports a percentage-point delta only for rates observed in both. It requires the same window length, source and release version, and nonoverlapping chronological windows. Incomparable inputs fail explicitly instead of making cross-cohort claims. A comparison does not establish causation, market share, or unique users.

The first real complete source/window is the baseline. Until then, all KPI baselines remain unknown. These calculations cannot establish live Discord acceptance, production readiness, V2 personal DM access, or actual adoption without supplied observations.

## Local command

From the repository, run `npm run build`, then `npm run measure -- snapshot.json` to analyze one aggregate snapshot. Use `npm run measure -- before.json after.json` for comparable windows. The command prints JSON to stdout and writes no files or network requests. Each input must be a regular JSON file of at most 64 KiB. Invalid inputs fail with exit code 1 and a fixed diagnostic that does not echo paths or rejected content. This command is a repository utility; it is not a Discord MCP tool or an adoption data collector.
