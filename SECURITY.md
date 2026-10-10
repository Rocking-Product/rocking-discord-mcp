# Security policy

## Current security status

This repository describes a local, single-operator MCP process authenticated to Discord with a bot token. Version `0.1.0-alpha.1` has passing automated tests and a read-only live sandbox smoke test. Security review found and fixed cancellation/error-boundary defects; full live acceptance and release gates remain open. No production security assurance is claimed.

The connector currently supports the bot-channel path only. It does not access the logged-in person's personal DMs. Complete history across the user's existing DM conversations is an approved V2 goal, subject to official feasibility, required Discord approval, demonstrated history coverage, and real-account acceptance. Selected-message interactions and bot DMs are not substitutes. Self-bots, copied personal tokens, and browser/session-cookie access are out of scope.

## Reporting a vulnerability

**Private vulnerability reporting is not yet activated or verified for this repository. There is currently no verified private disclosure route.** This must be configured and tested by repository maintainers before production use, public release, or inviting security testing. GitHub documents [how to enable private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository); after activation, maintainers must verify that a private report can be submitted and that the right owners receive notifications.

Until a private route is verified, do not post exploit details, credentials, private messages, or other sensitive evidence in public issues or discussions. Contact a repository administrator without including sensitive details and ask them to activate the GitHub reporting flow. This policy intentionally does not invent an email address or imply that another private channel is active. Do not send the report itself until maintainers verify a secure route.

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
