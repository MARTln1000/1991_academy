# Security

## Access control

- Closed platform: no self-registration. Accounts are created by
  administrators or through single-use invitation links.
- Without a session only the sign-in page, its assets and the privacy policy
  are served. Lessons (`js/data/`), course files, media and the leaderboard
  require authentication; Caddy checks the session before serving media.
- Administrator rights are granted only through the server CLI. Admin
  endpoints verify the flag on every request, before reading the request
  body. All administrative changes are written to an audit log.
- Administrators cannot reset other administrators' passwords or delete
  administrator accounts from the panel.

## Authentication

| Control | Implementation |
|---------|----------------|
| Password storage | scrypt (n=16384, r=8, p=1), 16-byte random salt per user, constant-time comparison |
| User enumeration | Unknown accounts incur the same hashing cost; failures return the same message |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie; 30-day lifetime; revoked on password change |
| Temporary passwords | ~59 bits, hashed, 14-day expiry, single use, grant no session (only a password change) |
| Invitation links | 192-bit token, stored as SHA-256, single use, 7-day expiry, carried in the URL fragment (never sent in requests or `Referer` headers) |
| Race conditions | Temporary-password redemption and link claiming are conditional updates inside one transaction |
| Brute force | Failure-only limits: 10 per minute per IP, 20 per 15 minutes per account (then a 15-minute pause). Invalid invitation tokens count toward the IP limit. |
| Disposable email | Addresses at ~9,200 disposable-email domains (and subdomains) are rejected |

## Web application

| Threat | Mitigation |
|--------|------------|
| SQL injection | All queries are parameterized. The only dynamic SQL fragments are constants or whitelisted `ORDER BY` clauses. |
| XSS | Output is escaped (`esc()`). CSP: no inline scripts, no `eval`, no workers; scripts only from the site and one pinned KaTeX release with SRI hashes. Admin-authored lesson HTML is sanitized with an allowlist (nh3). |
| CSRF | API writes require `Content-Type: application/json`; no CORS is granted, so cross-origin forms cannot submit. |
| Path traversal and source disclosure | Static files are served from an allowlist; hidden and relative path segments are rejected; case variants (e.g. `/APP.PY`) cannot match. |
| Clickjacking, MIME sniffing | `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`, `X-Content-Type-Options: nosniff` |
| Transport | HTTPS with HSTS (`max-age=31536000; includeSubDomains`); HTTP redirects to HTTPS |
| Information disclosure | No `Server` header, API docs disabled in production, `/api/health` not exposed publicly, generic 500 responses |
| Search indexing | `X-Robots-Tag: noindex, nofollow` and `Disallow: /` |
| Oversized requests | 300 KB request-body limit |
| IP spoofing | `X-Forwarded-For` is trusted only behind Caddy, which overwrites it; the app port is bound to loopback |

## Infrastructure

- Containers run as non-root with read-only filesystems, no Linux capabilities
  (Caddy keeps `NET_BIND_SERVICE`), `no-new-privileges` and process limits.
- No secrets are required; `.env` holds only non-sensitive settings and is
  untracked.
- Learner code runs in Google Colab, never on the server.
- CI audits pinned dependencies with pip-audit on every push and weekly.
- Base images are refreshed weekly by the auto-update job.

## Reporting

See [SECURITY.md](../SECURITY.md).
