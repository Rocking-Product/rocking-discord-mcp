# Release evidence and operations

This checklist distinguishes a tested local candidate from an accepted production release. Release version: `0.1.0-alpha.1`. No public package or production deployment is claimed.

## Local candidate

- Run `npm ci --ignore-scripts` from the lockfile.
- Run `npm run check`: includes core policy/transport tests, MCP client tests and an actual CLI/stdio subprocess with a synthetic HTTP preload. The preload is a test-only file excluded from the package.
- Run `npm audit --omit=dev --audit-level=high`; review all production dependency findings. A zero result is a point-in-time advisory check, not an independent security certification.
- Run `npm pack --dry-run --json`; confirm only documented distribution files, no tests, `.env`, `.local`, real identifiers, credentials or workspace artifacts. `prepack` rebuilds the executable to avoid shipping stale output.
- Run `npm run verify:package` after building; it verifies npm's actual file inventory against an explicit distribution allowlist. It does not replace a content/secret scan.
- Generate `npm sbom --sbom-format=cyclonedx --omit=dev` and keep the inventory with the exact release evidence.
- Refresh [the dependency license inventory](dependency-licenses.md) from that SBOM. The current npm package does not bundle third-party code; preserve installed dependency notices if redistributing a complete installation.
- Run a secret scan on the complete candidate, including Git history, before making it public. Manually inspect the tarball and review third-party licenses/notices.

CI is configured for Windows and Ubuntu using pinned action revisions with read-only repository permissions. Its configuration being present does not prove a remote CI run passed. Record the run URL and exact SHA after pushing.

## Live pilot acceptance

Use an authorized test channel and the approved bot. Keep actual IDs/configuration/evidence in ignored private storage.

1. Verify bot identity matches the intended application and record only a boolean result/version/time.
2. Read one history page from the allowed test channel through the real MCP process; verify a known synthetic fixture, not arbitrary private content.
3. Attempt an out-of-allowlist channel: no channel request may be dispatched.
4. With administrator coordination, revoke the test bot's channel access; verify the next operation fails. Restore only the original authorized permission afterwards.
5. If writes are enabled, explicitly authorize one synthetic message and reply in the test channel; confirm mention/preview suppression. No production channel writes are implied by read authorization.
6. Coordinate token rotation if necessary: it can interrupt any other process using the bot. The user owns copying/resetting the token; never print it or put it in shell arguments.
7. Stop and restart the exact candidate read-only. Confirm its tool list omits send and all previous per-process authorization state is gone.

## Open-source publication gates

Record: repository under Rocking, exact commit/tag, CI URL, artifact hash and fresh-install success; license and notices; protected release permissions/provenance; active private vulnerability-reporting route tested with a synthetic report; responsible maintainers; truthful capabilities/known limitations. Add MCP Registry metadata only after the repository/package namespace is verified.

Publish no personal DM claim until the separate V2 approval and history-coverage gate succeeds. Channel V1 can be released independently under the explicitly approved sequence.

## Rollback and incident handling

Stop the MCP process in the host to disable all tools. Disable writes in configuration and remove the write allowlist before restarting. Reinstall the previous reviewed pinned release and relaunch with the same narrow scope only after confirming compatibility. For the first alpha there is no previous released version: rollback is stop/uninstall, not a fictitious version downgrade.

If a credential is exposed, rotate it before restart and examine authorized resources privately. Rollback cannot undo a message already sent or reverse data disclosure. Preserve content-free evidence and use the private disclosure channel once verified.

## Measurement handoff

Launch starts the D7/D14/D30 observation clock; development and synthetic test counts are not adoption. Follow `launch-strategy.md` for denominators, consent and experiment decisions. Record unavailable observations as unknown, never zero. Each improvement needs a spec, meaningful regression, reviewed release and a comparable post-release measurement window.
