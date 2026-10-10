# Product specification — Rocking Discord MCP

Status: specification for implementation, 2026-10-10. Full requested outcome remains unproven. Owner: Rocking. Working repository name: rocking-discord-mcp.

Product decision from Francisco on 2026-10-10: explicitly build and validate V1 channels first, then V2 complete personal DMs. V1 is an approved intermediate release, not fulfillment of R3. Provider separation must preserve the V2 path. The existing bot has been authenticated and installed in a newly created isolated test server. A narrow read-only MCP configuration has passed an installed-artifact live smoke test; Rocking remains outside this test configuration. Known-text read, live revocation and optional writes are separate pending checks.

## Objective and audience

Give operators and developers a controlled way to use their MCP-compatible assistant with Rocking Discord channels and, where Discord officially permits it, personal direct messages. Publish reusable open source under Rocking, document security boundaries, earn community trust, measure adoption and ship evidence-driven improvements.

The requested 100% market share is an ambition, not a measurable completion condition without a defined market and independently observable denominator. Do not manufacture a denominator, adoption, savings, or time series. Retain the long-term growth objective while reporting actual milestones separately.

## Requirement ledger

| ID | Requirement | Acceptance evidence | Initial status |
|---|---|---|---|
| R1 | Specs before implementation, including cybersecurity | Versioned product, API contracts, threat model, test plan and decision records | In progress |
| R2 | Access authorized Rocking server channels | Real bot installation; allowed history read succeeds; denied guild/channel fails; permissions revocation fails closed | Not live-validated |
| R3 | Access existing DMs of logged-in personal account | Official authorized integration, actual account consent, received and sent messages, documented history coverage and revocation proof | Blocked on provider capability/approval research; not replaced by bot DMs |
| R4 | Useful channel operations | List authorized guilds/channels, bounded history with cursor, optional explicit send/reply, capability report | Planned |
| R5 | Security by design | Threat model controls and adversarial integration tests; independent review with no unresolved critical/high findings | Planned |
| R6 | Open-source publication by Rocking | Public repository, license, clean package, contribution/security docs, verified installation and release provenance | Planned |
| R7 | Distribution strategy led by X | Reviewable launch copy, demo, distribution calendar, truthful capability claims, actual authorized publication evidence | Planned |
| R8 | KPI measurement and improvements | Baseline with source/time window/coverage; post-launch cohorts; experiment decision; tested released improvement | Requires launch and observation windows |
| R9 | Adjacent ideas roadmap | Ranked hypotheses, validation cost/benefit assumptions, stage gates and stop rules | Planned |
| R10 | Estima planning | Verified project and tasks with ownership boundaries, dependencies and acceptance; no fabricated effort entries | In progress |

## Release sequence

1. S0: specs, official API feasibility, backlog, threat model, launch and KPI plan.
2. S1: local stdio channel connector with deny-by-default allowlists and production-quality tests. Local candidate is not the entire requested product.
3. S2: Rocking sandbox/live acceptance, independent security review, supply-chain checks, installation and rollback rehearsal.
4. S3: truthful open-source release and launch assets; explicitly disclose unresolved R3. Publishing a channel-only release does not fulfill R3 or close the full objective.
5. S4: collect observations at 7/14/30 days after launch, prioritize one evidenced issue, implement/regression-test/release the next version, repeat.
6. R3 parallel track: seek official RPC/partner feasibility, validate scope/history coverage; implement only after the route is demonstrated. Selected-message ingestion or manual export require an explicit product decision and cannot silently fulfill automatic full-inbox access.

## Boundaries and prerequisites

The public package must not embed Rocking IDs or credentials. Each installation supplies an isolated bot token and exact guild/channel allowlists. There is no global hosted tenant service in S1. A user logged into the Discord desktop/browser client is not automatically authenticated to this MCP.

Bot setup needs a Discord application controlled by Rocking, installation by a member able to manage the server, View Channel and Read Message History on chosen channels, and applicable Message Content intent settings/approval. Sending requires Send Messages; threads may require Send Messages in Threads. Never require Administrator for the product.

Live sending tests use an explicitly designated test channel and synthetic marker. No mass messaging. No public claims from mock results. A real deployment acceptance record includes version, redacted configuration fingerprint, installer, allowed/denied scenarios, rotation/revocation, and rollback; store sensitive evidence outside the public repository.

## Personal direct message capability research

Official bot auth cannot read other people's conversations with the logged-in person. User-installed apps can receive explicitly selected messages through context commands but do not gain a personal inbox. `dm_channels.read` exposes DM channel information to approved partners; `messages.read` refers to local RPC, not general REST. RPC requires further authorization/testing and does not document complete historical pagination. No personal account tokens or self-bots will be used.

Sources verified 2026-10-10: [OAuth2 scopes](https://docs.discord.com/developers/topics/oauth2), [RPC](https://docs.discord.com/developers/topics/rpc), [message history](https://docs.discord.com/developers/resources/message#get-channel-messages), [application commands](https://docs.discord.com/developers/interactions/application-commands#message-commands), [self-bot restrictions](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots).
