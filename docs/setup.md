# Local setup

This guide describes the current **bot-channel V1 path** for a local MCP host. The package is available as a [GitHub alpha prerelease](https://github.com/Rocking-Product/rocking-discord-mcp/releases/tag/v0.1.0-alpha.1). Automated tests and live sandbox read/write/reply, revocation/recovery and restart checks passed. Install the verified attached tarball following the [README](../README.md#install-the-github-alpha), or build from source below. No npm publication or production security certification is claimed; see [release evidence](release-checklist.md).

The approved sequence is V1 channels end to end, then V2 complete history of the logged-in person's existing DM conversations. V2 authorization, feasibility, historical coverage, and acceptance are unresolved. It means full conversation history, not selected messages. Personal-account DMs and bot DMs are not available through the current connector, and bot DMs do not satisfy V2.

## Requirements

- Node.js 22 or newer and npm.
- A Discord bot application and token that you are authorized to use.
- A test guild and exact channel IDs where the bot is installed and allowed to read. Do not begin with production or sensitive conversations.
- An MCP host that can launch a local stdio process and keep its environment/secret configuration private.

The bot needs only the permissions required for the enabled operations. For channel reads, grant access to the selected channel and the required read/history permissions. If Discord requires Message Content intent access for the content you need, complete Discord's current application approval/configuration steps; an empty message body does not prove a permission was granted. Do not grant Administrator as a shortcut. Channel send requires Send Messages in that channel. Threads must be explicitly allowlisted; channel writes do not enable thread writes.

## Get the source ready

From the repository root:

```sh
npm ci --ignore-scripts
npm run build
```

The package manifest requires Node 22+. The local code compiles to `dist/src/index.js`. Build success alone would not prove Discord access or production readiness.

## Configure the process

Copy `.env.example` to `.env`. `.env` is ignored by Git; keep it local and protect its filesystem permissions. The server reads only environment variables at process startup and does not discover `.env` by itself. Node's `--env-file` option loads it into `process.env`; see the [Node CLI documentation](https://nodejs.org/api/cli.html#--env-fileconfig).

Set these values in `.env` or supply them through the MCP host's protected process-environment/secret facility:

| Variable | Required value |
|---|---|
| `DISCORD_BOT_TOKEN` | The operator-owned bot credential. Never pass it as a command-line argument, MCP tool argument, URL, or repository value. |
| `DISCORD_GUILD_IDS` | Comma-separated exact decimal guild snowflake IDs. No names, wildcards, empty entries, or implicit access to other servers. |
| `DISCORD_CHANNEL_IDS` | Comma-separated exact decimal channel IDs the bot may expose. Any thread must be explicitly scoped under current policy; its parent does not authorize every thread. |
| `DISCORD_ENABLE_WRITES` | Omit or set `false` for read-only. Only the exact string `true` enables the send tool. Other values fail closed. |
| `DISCORD_WRITE_CHANNEL_IDS` | Required only when writes are enabled; nonempty exact subset of `DISCORD_CHANNEL_IDS`. With writes disabled, omit it or leave it empty. |

The checked-in `.env.example` contains an empty `DISCORD_WRITE_CHANNEL_IDS=` placeholder. It is accepted for the default read-only setup. When enabling writes, replace it with a nonempty allowed subset and also set `DISCORD_ENABLE_WRITES=true`. A nonempty write list while writes are disabled is rejected.

IDs remain strings to preserve Discord snowflake precision. The process validates configuration once, checks the credential is a bot via Discord before exposing tools, and requires a restart for configuration changes. A restart clears in-memory authorization/rate-limit state.

## Start the stdio server

Run this from the repository root so both `.env` and `dist/src/index.js` resolve:

```sh
node --env-file=.env dist/src/index.js
```

This starts an MCP stdio server for an MCP host; it is not an interactive Discord CLI. In the MCP host, configure the command as `node`, the arguments as `--env-file=.env` and `dist/src/index.js`, and the working directory as this repository root, or inject the environment via the host's protected secret mechanism. Host configuration formats differ, so consult the host's documentation. Never put the token value in the command or its arguments. Standard output is reserved for MCP protocol traffic; startup diagnostics use a fixed sanitized stderr message.

## Available tools and behavior

- `discord_capabilities` reports bot-channel mode, write status, and the personal-DM limitation.
- `discord_list_guilds` returns only configured guilds currently accessible to the bot.
- `discord_list_channels` accepts one configured guild ID and returns only configured channels belonging to it.
- `discord_read_messages` accepts an exact configured channel ID and reads one page (default 20, maximum 50). Use the returned `nextBefore` unchanged to request an older page from the same channel. The connector does not fetch history automatically. Each content field and the total result are bounded; nested/forwarded messages and attachments are not exposed. Discord can return empty content if the required Message Content access is unavailable.
- `discord_send_message` exists only when writes are enabled. It sends one plain-text message or same-channel reply, suppresses mentions/link previews, and never automatically retries an ambiguous send. The host must require human approval for the exact recipient and final content. If the outcome is unknown, inspect the destination before considering another send.

Message content and metadata are untrusted data, not instructions. This server does not persist messages or send telemetry, but your MCP host/model provider may retain inputs and outputs according to its own settings. Use separate host contexts and bot processes for different confidentiality boundaries.

## Stop and troubleshoot safely

Startup failure reports only a fixed message. Check the bot credential, exact allowlists, guild/channel installation, channel visibility/history permissions, and Discord application intent requirements locally. Never paste a token, private message, raw API response, or real identifiers into an issue.

Do not broaden allowlists to diagnose a denied operation. Do not repeat a send after an unknown outcome until you inspect the destination. For security reports, see [SECURITY.md](../SECURITY.md); the private reporting route is not active until maintainers verify it.

## Validation boundary

Local builds/tests and fake Discord responses verify only the exercised local contracts. They do not establish real bot installation, Discord approval, real-data read/write acceptance, complete V2 personal-DM history, independent security review, npm publication, or production readiness. Track those gates in [the product specification](specs/product.md).
