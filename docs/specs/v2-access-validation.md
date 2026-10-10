# V2: full personal direct-message access — validation gate

V2 retains Francisco's requirement: access to complete existing conversations, including messages sent by others and historical pages. V1 channel release is explicitly approved as an intermediate step. V2 is not implemented and is not promised by installing a bot.

## Evidence required before implementing an account provider

1. Written/current official Discord scope and endpoint eligibility for this use case, including partner approval where required.
2. OAuth/RPC consent for a test account through the documented flow; no personal account token, cookie, browser session extraction or self-bot.
3. List accessible one-to-one and group conversations; demonstrate whether closed/archived conversations are covered.
4. Read a consenting test conversation with synthetic messages from both participants, including multiple historical pages older than the local client's initial message window. Compare coverage against the known fixture, not a random successful page.
5. Demonstrate revocation, expired credentials, denied conversation access, reconnect and process restart without cached unauthorized content.
6. Document retention and deletion semantics, rate limits, permitted distribution, and whether every open-source installer needs independent Discord approval.

Any unsupported item remains open. `dm_channels.read` metadata, message context commands, bot DMs and exports of only the user's own sent messages cannot satisfy this gate.

## Draft inquiry to Discord developer support / partner program

Do not submit until Rocking's responsible maintainer and correct official support destination are verified. No user credentials or conversation data are included.

> Rocking is developing an open-source, local MCP integration for Discord. We already separate server-bot access from personal-account capabilities. For a future opt-in personal provider, we need to determine whether an approved official OAuth/RPC integration can enumerate an authorizing user's existing one-to-one/group DM conversations and read both incoming and outgoing historical messages with complete pagination.
>
> Could you confirm the supported scopes, endpoints, approval requirements, historical coverage, distribution restrictions, and whether individual users of an open-source local client must obtain separate approval? We will not use self-bots or personal session tokens. Our design requires explicit consent, least privilege, local credential protection, cancellation, revocation, bounded access and no default telemetry or message persistence.
>
> We can provide a synthetic test plan and threat model. Please clarify whether the documented RPC `messages.read` path supports this exact use case or only a limited client window. If complete history is unavailable, we will document that limitation rather than market partial access as complete.

## Architecture once feasibility is proven

Implement a separately authenticated provider behind the MCP adapter's port. Split personal and guild sessions/credentials/configuration; no automatic fallback between identities. Scope tools to the authenticated principal and granted conversation set. Design OAuth state/PKCE/redirect validation, secure storage, expiry and revocation before code. Add a distinct capability report with evidenced history coverage. The bot provider must continue to advertise personal DM access as false.

References researched during S0: [OAuth2](https://docs.discord.com/developers/topics/oauth2), [RPC](https://docs.discord.com/developers/topics/rpc), [self-bot policy](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots). Revalidate current provider policy before applying or implementing.
