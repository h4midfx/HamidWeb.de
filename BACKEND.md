# Hamid Tools local server

Run `npm.cmd start` and open http://localhost:3000.
Requires Node.js 18 or newer; no external packages are needed.

The server serves the dashboard, troop calculator, crypto page and social portal.
`GET /api/health` reports server availability. Only explicitly listed public assets are served.

The social portal supports its own user accounts, private destination settings and a saved draft. Run the page through this server to use these features. Social account authorization and automatic publishing still require implementation and platform setup; see SOCIAL_PORTAL.md.

Portal API routes: `GET /api/portal/session`, `POST /api/portal/register`, `POST /api/portal/login`, `POST /api/portal/logout`, `GET/PUT /api/portal/settings`, `GET/PUT /api/portal/draft`, and `GET /api/portal/history`. Private routes require a session cookie and X-CSRF-Token obtained from login or the session endpoint. Writes use JSON request bodies.

Run `npm.cmd test` to check website routes, authentication, private-file protection and user data isolation.

Users can also enter API access tokens in the social portal. Tokens are verified with the official API, encrypted on the server, and scoped to their portal account. They can be rechecked or removed from the portal. See SOCIAL_PORTAL.md for supported credential types and encryption-key configuration. Automatic publishing is still not implemented.
