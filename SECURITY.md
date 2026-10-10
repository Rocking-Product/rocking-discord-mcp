# Security policy

## Current security status

This repository describes a local, single-operator MCP process authenticated to Discord with a bot token. Version `0.1.0-alpha.1` has passing automated tests and a read-only live sandbox smoke test. Security review found and fixed cancellation/error-boundary defects; full live acceptance and release gates remain open. No production security assurance is claimed.

The connector currently supports the bot-channel path only. It does not access the logged-in person's personal DMs. Complete history across the user's existing DM conversations is an approved V2 goal, subject to official feasibility, required Discord approval, demonstrated history coverage, and real-account acceptance. Selected-message interactions and bot DMs are not substitutes. Self-bots, copied personal tokens, and browser/session-cookie access are out of scope.

## Reporting a vulnerability

The maintainer-approved private contact is **Francisco Leguizamón**, at **[fleguizamon@rockingproduct.com](mailto:fleguizamon@rockingproduct.com)**. Use a subject such as `Discord MCP security report` and synthetic reproduction details. The maintainer supplied this destination on 2026-10-10; delivery and receipt of a non-sensitive test report have not yet been verified. No response-time commitment is active.

**GitHub private vulnerability reporting is not yet activated or verified for this repository.** Before production use, public release, or inviting security testing, verify the private contact's receipt of a synthetic report. GitHub documents [how to enable private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository); after activation, maintainers must verify submission and notifications separately.

Until receipt is verified, contact the designated maintainer without sensitive evidence. Do not post exploit details, credentials, private messages, or other sensitive evidence in public issues or discussions. Do not send sensitive report details until the maintainer confirms the private route works.

GitHub documents private vulnerability reporting for public repositories. While this repository is private, maintainers must establish and test an alternative private contact route before source publication, following [the publication sequence](docs/release-checklist.md#private-to-public-disclosure-sequence). Source visibility, a package release and a verified reporting route are separate steps; none proves the others are complete.

When reporting becomes available, include the affected revision, impact, reproduction steps using synthetic data, and mitigations if known. Redact tokens, Discord content, real guild/channel/user IDs, and private URLs. Do not test against servers or accounts without authorization.

## Scope and limits

Report issues that can affect this repository's code or documented connector behavior, including credential exposure, access beyond exact allowlists, cross-channel disclosure, unsafe tool dispatch, unbounded requests/results, or a send to an unintended destination.

The local process trusts its MCP host and operating system. Once Discord content reaches that host, this server cannot control model-provider retention, host logging, other tools, or onward sharing. Configure host confidentiality boundaries accordingly. A bot's permission to read a channel does not establish the human operator's permission to process it.

## Maintainer response gate

Before production use or public release, maintainers need to:

1. Enable GitHub private vulnerability reporting or establish another verified private channel.
2. Test submission and notification with a non-sensitive test report.
3. Name maintainers responsible for triage and define a response target they can support.
4. Keep reports private while assessing and fixing an issue; coordinate disclosure with the reporter.
5. Publish a sanitized advisory or release note when appropriate, without exposing users or private Discord data.

No response-time promise is active until maintainers set and publish one.
