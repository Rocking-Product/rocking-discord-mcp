# Contributing

Thanks for helping improve Rocking Discord MCP. The package is currently `0.1.0-alpha.1`, a local alpha without end-to-end acceptance. Please frame changes as proposals until maintainers publish release evidence.

## Before opening a change

- Read `AGENTS.md`, `docs/specs/product.md`, `docs/specs/architecture.md`, and `docs/specs/security.md`.
- Keep V1 focused on the official bot's explicitly allowlisted server channels. V2 is the approved goal of complete history across the user's existing personal DM conversations; it is not selected-message access and is not currently available. Do not substitute bot DMs or use a personal token/self-bot.
- Use only official Discord API routes. Do not add arbitrary URL fetching, credentials in tool arguments, secret logging, message persistence, or expanded scopes without a separate design and security review.
- Treat all Discord-provided text and metadata as untrusted. Preserve bounded schemas, exact allowlists, safe errors, and the host approval boundary for writes.
- Never include tokens, conversation content, real guild/channel identifiers, or private operational evidence in the repository. Use synthetic fixtures.
- Document public APIs, security intent, configuration changes, and changed user-visible behavior. Update the relevant specs and setup guidance when a contract changes.

## Local workflow

Use Node.js 22 or newer and npm:

```sh
npm ci
npm run build
npm test
npm run check
```

Run the relevant commands for your change and report exactly what ran and its result. Do not describe fake-provider tests as Discord integration or production acceptance. Do not claim a command passed unless its output confirms that.

For a manual local run, use a protected `.env` copied from `.env.example` and the command in `docs/setup.md`. Keep the bot restricted to a test server/channel. Do not enable writes unless the MCP host can obtain human approval for the exact destination and final content.

## Pull request description

Include:

- the behavior or security boundary changed and why;
- affected MCP tools/configuration and migration steps, if any;
- commands run and results, plus any validation that remains outstanding;
- security/privacy implications and evidence source for Discord behavior claims.

A pull request does not authorize publication, production use, or external claims. Releases require the acceptance evidence in `docs/specs/product.md` and an active, verified private security disclosure path.
