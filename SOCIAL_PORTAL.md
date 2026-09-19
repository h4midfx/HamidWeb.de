# Social Portal

Run `npm.cmd start`, then open http://localhost:3000/SocialPortal.html.
If the server was already running, restart it after updating the code.

## Working locally

- Portal registration, login and logout. Usernames are case-insensitive; passwords must contain 12–128 characters. Use a new password for this portal, not a social account password.
- Account-specific destination settings and one saved text draft. Settings and text survive server restarts.
- Original-text preview. Saving or previewing does not send a post.
- Publishing history with an honest empty state: no social publisher is connected yet.
- HTTPS platform URL validation for Telegram, Facebook and Instagram links.
- User-supplied Telegram and Meta API connections with verification, encrypted token storage, recheck and removal.

Portal account data is stored in `data/portal.json`, excluded from Git and from the public asset allowlist. Passwords use salted scrypt hashes. Sessions use HttpOnly, SameSite=Strict cookies, expire after 12 hours, and are invalidated on logout or server restart. Authenticated API calls require a session-specific CSRF token; writes also check the request origin. Registration and login are limited to 20 attempts per IP per 15 minutes.

The old browser-only setup is not imported automatically, because it cannot be attributed to a specific user. Re-enter settings after signing in. Do not enter access tokens in account-link fields.

## Still required for live automatic posting

The site owner supplies the public HTTPS domain and hosting. Users can supply their own supported API tokens through the connection form. For a future one-click social login flow, the service also needs its own registered platform apps and official consent screens. Do not collect social-media passwords.

Before opening registration to the public, finish OAuth consent/callback handling if offering social login, human channel ownership checks, account deletion and password recovery, and a durable delivery queue with retries and per-platform outcomes. The current JSON database and in-memory session/rate-limit stores are intended for one local server process; public deployment needs durable storage and appropriate deployment controls.

Telegram posts must be associated with verified channel owners. Unsupported media should be blocked with an explanation rather than rewritten. WhatsApp Channel support must be confirmed separately from WhatsApp Business messaging. No implementation can promise delivery to independent platforms at exactly the same instant.

## Server configuration

- `PORT`: defaults to 3000.
- `PORTAL_DATA_DIR`: defaults to the local `data` directory. Use persistent private storage when deployed.
- `APP_ORIGIN`: exact public origin, such as `https://portal.example.com`. An HTTPS origin enables Secure session cookies. Leave unset for local HTTP development. The HTTPS reverse proxy must preserve the public origin for browser requests.

Environment variables are read from the process environment; `.env` files are not loaded automatically.

## Verification

`npm.cmd test` checks public asset access, private-file protection, authentication, account isolation, draft preservation, validation, CSRF/origin rejection, logout and persistence across restart.

References: https://core.telegram.org/bots/api ; https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00

## User-supplied connections

Users now enter their own API credentials in the portal's Save and verify connection form. The server uses them for read-only verification with the official platform API, then saves only encrypted tokens. The Check again button decrypts and reuses the saved credential without asking the user to paste it again. Multiple accounts are supported; saving the same platform/account replaces that connection's token. Remove from portal deletes the saved credential, but does not revoke it at the platform.

Supported credential types:
- Telegram: personal bot token plus channel @username or numeric channel ID. Verification checks getMe, getChat and the bot's administrator membership. This establishes the bot's access; it does not independently verify the human user's Telegram identity.
- Facebook: Page access token and matching numeric Page ID. Verification requires /me to resolve to that Page.
- Instagram: Page access token and the numeric ID of its linked Facebook Page. Verification resolves the accessible instagram_business_account. Direct Instagram Login tokens are not supported by this flow.
- WhatsApp Channel credentials are not accepted in this version.

A verified connection means the token currently identifies an accessible account. Publishing scopes, token expiry, supported media and delivery still need to be handled by the publishing service. This change performs no posting, reads no channel messages, registers no webhooks, and sends no test messages. Official social OAuth login and automatic posting are still not implemented. Users who already have developer/API access can supply their own tokens; a global site-owner token is not needed for these connection checks.

Tokens use AES-256-GCM with fresh random IVs and authentication bound to the portal user, connection ID and platform. API responses contain connection metadata only, never token values or ciphertext. Provider error bodies are not returned because they may echo credentials. Input is restricted to supported identifiers and fixed official API hosts; requests cannot redirect. Do not configure a proxy to log request bodies or authorization headers.

For local development, the first successful connection creates a private 32-byte data/connections.key. Keep that key with protected backups; deleting it makes saved tokens unreadable. For deployment, set PORTAL_ENCRYPTION_KEY to 64 hexadecimal characters from a secure secret manager instead, before creating connections. Changing key sources or key values does not automatically migrate old tokens. Encryption protects accidental database exposure, not a compromised server that has both the data and key.

Connection submission and checks require HTTPS configured via APP_ORIGIN, except requests from loopback to a localhost/loopback host during local development. An HTTPS deployment must keep the backend behind its HTTPS proxy. META_GRAPH_VERSION defaults to v26.0 and can be set by the site owner.

API additions: GET/POST /api/portal/connections, POST /api/portal/connections/:id/check, DELETE /api/portal/connections/:id. They use the existing portal cookie and CSRF token. Submissions/checks are limited to 10 per user per minute; simultaneous credential mutations for one user are rejected. A maximum of 20 connections per user is supported.

Automated tests use synthetic credentials and mocked provider replies; no live user credentials or accounts were used.
