# Rocking Discord MCP

Local MCP server for using a Discord bot to inspect explicitly allowlisted server channels. The project is designed around narrow permissions, bounded reads, untrusted-message handling, and opt-in writes.

## Status

The package manifest declares version `0.1.0-alpha.1`. This is an unreleased alpha: 36 automated tests pass, including a real stdio subprocess with synthetic Discord responses. An installed tarball completed live sandbox reads, two explicitly approved message/reply sends, exact content verification, and a subsequent read-only restart. It denied an out-of-scope guild; reply references, preview suppression and absence of mentions were verified. Live permission revocation and recovery were also verified; publication gates remain open. See [candidate evidence](docs/release-checklist.md#verified-candidate-evidence). The package name and publication status on npm are unconfirmed. Do not treat this as a released `npx` package or as production-ready.

The approved product sequence is:

- **V1:** validate the complete channel workflow with the official Discord bot/app: configuration, installation, scoped reads, and optional explicitly approved channel sends.
- **V2:** pursue complete history across the logged-in person's existing DM conversations. Official feasibility, approval, history coverage, and real-account acceptance remain open. V2 means full conversation history, not selected-message interactions. Bot DMs do not satisfy this requirement.

See [the product specification](docs/specs/product.md), [launch strategy](docs/launch-strategy.md), and [setup guide](docs/setup.md).

## Current connector contract

The local source registers these MCP tools:

- `discord_capabilities`: reports bot-channel mode, write status, and that personal-account DMs are unavailable.
- `discord_list_guilds`: lists only configured guilds currently accessible to the bot.
- `discord_list_channels`: lists configured channels in one configured guild.
- `discord_read_messages`: reads one page from an explicitly allowlisted channel; default 20, maximum 50. `nextBefore` is an opaque cursor for the same channel. It does not crawl history automatically.
- `discord_send_message`: exposed only when writes are enabled; one plain-text send or same-channel reply to an explicitly write-allowlisted channel. The MCP host must obtain human approval for the exact destination and content before calling it.

The connector uses Discord's official bot API. It does not access personal-account DMs, bot DMs, group DMs, attachments, webhooks, moderation APIs, or arbitrary URLs. Message text is untrusted input. A bot's channel access is not proof that the human operator has the same authorization. The host controls model-provider retention and other tools in its context; use a separate host context and process for each confidentiality boundary.

## Local source setup

Prerequisites: Node.js 22 or newer and npm. Follow [docs/setup.md](docs/setup.md) for bot permissions, allowlists, environment setup, and the limitations of local validation.

```sh
npm ci
npm run build
```

Create a private `.env` from `.env.example` and fill it with your own bot token and exact test guild/channel IDs. Its empty `DISCORD_WRITE_CHANNEL_IDS=` placeholder is accepted in the default read-only mode. Then run the local stdio process from the repository root:

```sh
node --env-file=.env dist/src/index.js
```

Node does not automatically load `.env`; the command explicitly asks Node to load it. `.env` is ignored by Git. Never put the token in command arguments, tool inputs, public config, logs, or commits. An MCP host should launch the same process and provide the operator-owned environment through its secret mechanism or a protected env file. Host configuration formats vary; do not copy a host-specific JSON example without checking that host's current schema.

Writes are off by default. To enable them, set `DISCORD_ENABLE_WRITES=true` and provide a nonempty `DISCORD_WRITE_CHANNEL_IDS` subset of `DISCORD_CHANNEL_IDS`. Keep writes disabled until the host can require approval for each exact recipient and final message. A timeout can leave a send outcome unknown; inspect the destination before considering a new send.

## Development

```sh
npm run build
npm test
npm run check
```

These are the available local commands, not claims that they have passed in a particular environment. Local tests and mocked Discord responses do not prove real account authorization, bot installation, permission intent approval, end-to-end acceptance, security review, or production readiness. See [CONTRIBUTING.md](CONTRIBUTING.md) and the verification gates in the specs.

## Security and disclosure

Read [SECURITY.md](SECURITY.md) and [the security specification](docs/specs/security.md) before connecting real Discord data. The private vulnerability reporting route has not yet been activated or verified; that is a release gate. Do not publish credentials, private Discord messages, real guild/channel IDs, or exploit details in public issues.

## License

MIT; see [LICENSE](LICENSE).

