# Administration

## Accounts

The platform is closed: there is no self-registration and the application
sends no email. Unauthenticated visitors can open only the sign-in page and
the privacy policy.

Students are onboarded in one of two ways, both from **Admin panel →
Learners**:

| Method | Flow |
|--------|------|
| Invitation links (default) | The administrator creates one link per student, optionally annotated with the recipient, and sends the generated message from their own mailbox. The student opens the link, enters the email address they want to use (and optionally a username), receives a temporary password and sets their own password immediately. |
| Add students | The administrator enters email addresses (optionally `email, username`). Each account receives a temporary password, displayed once, with a generated message to send. |

Onboarding messages are generated in Armenian.

### Rules

| Item | Rule |
|------|------|
| Invitation link | Single use, valid 7 days, stored as a SHA-256 hash. Not bound to an email address. Can be cancelled while unused. Listed in the panel for 30 days after expiry. |
| Temporary password | 12 characters (`xxxx-xxxx-xxxx`, no ambiguous characters), valid 14 days, usable only to set a new password, single use. Issuing one signs the account out everywhere. |
| Username | 3-20 characters: letters, digits, underscore. Derived from the email address if omitted. |
| Email | Unique (case-insensitive). Addresses at disposable-email domains are rejected (`disposable_email_domains.txt`, refreshed with `make disposable-list`). |
| Password | At least 8 characters. Changing it signs out all other sessions. |
| Session | 30 days. |
| Leaderboard | New accounts are listed once they earn XP; users can opt out on their account page. |

### Password recovery

- **Students:** an administrator opens the student in the panel and selects
  **New temporary password**.
- **Administrators:** on the server, `make password NAME=<username>`.
  Administrators cannot reset each other's passwords from the panel.

## Administrators

Administrator rights are a flag on the account and can be changed only from
the server command line; no HTTP endpoint can grant them.

```bash
make admin NAME=<username> [EMAIL=<email>]   # grant; with EMAIL, create the account
make admin-remove NAME=<username>            # revoke
make admins                                  # list
make password NAME=<username>                # issue a temporary password
```

Without Docker: `.venv/bin/python app.py admin add <username> [<email>]` and
the equivalent subcommands (`python app.py admin` prints usage).

## Admin panel

Available at `/admin.html` for administrators (linked from the navigation bar).

| Section | Functions |
|---------|-----------|
| Overview | Accounts, sign-ups and lesson completions over 30 days, per-track progress, most and least completed lessons, Lab and mission statistics. |
| Learners | Invitation links, adding students, search and sort, per-student progress, new temporary password, sign out everywhere, delete account. |
| Lessons | Edit built-in lessons or add new ones (English and Armenian text, takeaways, quiz, videos). Published changes are live immediately; drafts are hidden. Edits to built-in lessons can be reverted. Shows which lecture videos are self-hosted. |
| Announcements | Banners shown at the top of every page, in both languages. |
| Activity log | All administrative changes (latest 200). |

Lesson HTML is sanitized on save; scripts, styles, event handlers, images and
frames are removed. Administrator accounts cannot be deleted from the panel.

Accounts that use a disposable email address (created before the domain was
listed) are flagged in the Learners list and counted on the Overview.

## Personal data

The privacy policy (`privacy.html`, English and Armenian) describes what is
stored and for how long. Keep it consistent with the application whenever
data handling or retention changes. Users can delete their own accounts; the
deletion removes all associated data.
