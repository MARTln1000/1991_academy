# HTTP API

All endpoints are under `/api`. Request and response bodies are JSON unless
noted. Write requests (`POST`, `PUT`, `DELETE`) must use
`Content-Type: application/json` (otherwise 415) and are limited to 300 KB.

Authentication uses the `msession` cookie set by the sign-in endpoints.
Errors have the form `{"error": "<message>"}` with an appropriate status code.

In debug mode an OpenAPI description is available at `/api/docs`.

## Authentication

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/login` | `{identifier, password}` (username or email) | 200 `{user}` + cookie. 403 `{mustChangePassword, username}` for a temporary password. 401 on failure, 429 when rate limited. |
| POST | `/api/first-password` | `{identifier, password, newPassword}` | Replaces a temporary password; 200 `{user}` + cookie. |
| POST | `/api/logout` | | 200 `{ok}`; clears the cookie |
| GET | `/api/me` | | 200 `{user}` or 401 |
| POST | `/api/change-password` | `{currentPassword, newPassword}` | 200 `{ok}`; other sessions are revoked |
| POST | `/api/delete-account` | `{password}` | 200 `{ok}`; deletes the account and its data |

`user` is `{username, email, created, leaderboardOptIn, xp, admin}`.

## Invitation links

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/join/check` | `{token}` | 200 `{ok, days}` or 410 `{error, problem}` where `problem` is `unknown`, `used`, `expired` or `cancelled` |
| POST | `/api/join` | `{token, email, username?}` | 200 `{username, email, password, days}` (temporary password); 400 for invalid input (link stays unused); 410 as above |

Invalid tokens count toward the per-IP failure limit.

## Progress and leaderboard

Require a session.

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/api/state` | | `{data: object or null, updated: timestamp or null}` |
| PUT | `/api/state` | `{data: {key: string}}` | `{ok}`; all values must be strings |
| GET | `/api/leaderboard` | `?period=week` or `all` | `{top: [{username, xp}], you: rank or null, period}` (top 20) |
| POST | `/api/leaderboard-optin` | `{optIn: bool}` | `{ok, optIn}` |

## Content and infrastructure

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/content.js` | JavaScript assigning `window.ACADEMY_CUSTOM = {lessons, announcements, media}`. Without a session, only announcements. |
| GET | `/api/auth-check` | 204 with a valid session, else 401 (used by Caddy for `/media`) |
| GET | `/api/health` | `{ok, uptime_s, debug, secure_cookies, trust_proxy, week, version, revision}`. Not exposed through Caddy. |

## Administration

Require an administrator session (401 without a session, 403 for
non-administrators). Changes are recorded in the audit log.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/overview` | Aggregate statistics |
| GET | `/api/admin/users?q=&sort=created\|active\|xp\|name&offset=` | Paginated account list (50 per page) |
| GET | `/api/admin/users/{username}` | Account details and progress |
| POST | `/api/admin/users/{username}/temp-password` | Issue a temporary password (409 for administrators) |
| POST | `/api/admin/users/{username}/sign-out` | Revoke all sessions |
| POST | `/api/admin/users/{username}/delete` | Delete an account (409 for administrators) |
| POST | `/api/admin/students` | `{students: [{email, username?}]}` (max 200); returns per-entry results with temporary passwords |
| GET | `/api/admin/join-links` | Invitation links from the last 30 days with status |
| POST | `/api/admin/join-links` | `{sentTo: [string]}` (max 200); returns `{links: [{id, sentTo, link}], days, warning}` |
| POST | `/api/admin/join-links/{id}/cancel` | Cancel an unused link |
| GET | `/api/admin/lessons` | All admin-authored lessons |
| PUT | `/api/admin/lessons/{id}` | Create or update a lesson (validated and sanitized) |
| POST | `/api/admin/lessons/{id}/preview` | Validate and sanitize without saving |
| DELETE | `/api/admin/lessons/{id}` | Delete a lesson (reverts a built-in override) |
| GET | `/api/admin/announcements` | All announcements |
| POST | `/api/admin/announcements` | `{text, text_hy?, level: info\|warning, active?}` |
| PUT | `/api/admin/announcements/{id}` | Update |
| DELETE | `/api/admin/announcements/{id}` | Delete |
| GET | `/api/admin/log` | Latest 200 audit entries |
| GET | `/api/admin/media` | Self-hosted media index with file sizes |
