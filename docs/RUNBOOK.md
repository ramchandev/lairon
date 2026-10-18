# LAIRON EZ — operations runbook

For the person looking after the system day to day. Everything below is done from inside the app unless it says otherwise.

## People
| Task | How |
|---|---|
| New driver / staff / admin | Users → *Add* (admins: Settings → Admins). They get an email to set a password. If the email can't be sent you're shown a one-time link to share. |
| New Doctor's Manager | Users → Doctor's Managers → *Add*. They sign in with their mobile number — no password. Add an email only if they should receive notification emails. |
| Someone left | Users → *Deactivate*. They're signed out immediately; their records stay. |
| Forgot password | Staff/driver/admin: "Forgot password?" on the sign-in page. Or Users → *Resend invite*. |
| Manager can't sign in | Is their number registered and active (Users → Doctor's Managers)? After 5 wrong tries they're locked out for 15 minutes. |
| Phone number changed | Users → Edit. (Staff/driver **email** is their login and can't be changed in the app — create a new user if it must change.) |
| Sign someone out everywhere | Users → *Sign out*. |

## Requests
- **Service requests**: Service requests → open → Approve / Reject (reason is required and emailed) / Mark fulfilled. A rejected request is final; the manager submits a new one.
- **Starter packs**: Starter packs → open → Processing / Fulfilled / Cancel (reason). **PDF** and **CSV** buttons on the list export exactly what the filters show.
- **Doctor moved to another manager**: Doctors → *Reassign*.

## Drivers, leave and beta (month end)
1. Trip duty → **Leave requests**: clear the queue (approve/reject).
2. Trip duty → **Driver month**: spot-check; add or edit missing duties. For past months use **Import duties** (Excel/CSV): review the checks and the *Beta preview* before importing. **Undo** removes an import.
3. Trip duty → **Chauffeur beta**: pick the month → check the totals → *Day-wise* for any driver to see exactly why → **CSV/PDF** for payroll.
4. **Finalise month**. Later edits no longer change what was paid. To correct a finalised month: *Reopen* (a reason is required), fix, finalise again.
5. **Rate change**: Edit rates → add a new rate with its **effective date**. Earlier days keep the old rate. It can't start inside a finalised month.

Beta rules in one line: closed duties only; several duties on one date = one day; if any is Outstation the day is Outstation; rate = the one in force on that date.

## Settings & content
- **Dropdowns**: changing/deleting an item never changes saved records (they store plain text). Use the switch to hide an item.
- **Settings**: company name (PDF headers), driver edit window (days drivers can add/change their own entries), admins.
- **Email log**: see every email and why one failed; *Retry* re-sends. *Notification recipients* choose who gets "new request" emails.

## When something looks wrong
| Symptom | Check |
|---|---|
| No emails arrive | Email log: any rows? *Skipped / No recipients* → set recipients. *Failed* → read the Detail (unverified Resend domain is the usual cause) and Retry. No rows at all → `edge_config` rows missing, `pg_net` disabled, or `notify` not deployed (`npm run smoke:supabase`). |
| "Edit window" errors for a driver | The entry is older than the edit window; edit it as admin (Trip duty → Driver month → Edit). |
| Beta looks wrong | Chauffeur beta → pick the driver → *Day-wise*. A day with only an *open* duty pays nothing — close it. Check the rate card date. |
| Import preview shows errors | Fix the sheet (the check list gives row numbers). Dates must be readable; a day can't have both a duty and a week off. |
| App shows an old version | Close and reopen it; the installed app updates itself on the next load. |
| "Something went wrong" page | Reload. If it persists: Supabase Dashboard → Logs for the time of the error. |
| Supabase project paused (free plan) | Dashboard → *Restore*. Production should be on Pro. |

## Rotating secrets
| Secret | Steps |
|---|---|
| **Resend API key** | Create a new key in Resend → `supabase secrets set RESEND_API_KEY=…` → delete the old key. No redeploy needed. |
| **Webhook secret** (`NOTIFY_WEBHOOK_SECRET`) | Generate a new value → `supabase secrets set NOTIFY_WEBHOOK_SECRET=…` **and** update `edge_config.notify_secret` in SQL (they must match). |
| **Supabase service-role / secret key** | Dashboard → Settings → API keys → rotate. Functions pick up the new one automatically. It should exist nowhere else (`npm run preflight` scans the build for it). |
| **An admin's password / a lost phone** | Users → Resend invite; deactivate the account if a device was lost. |

## Safety rules
- Never put the service-role key, the Resend key or the webhook secret in the front-end build or in git.
- Test imports, migrations and bulk edits on **staging** first.
- Take a manual backup (Dashboard → Database → Backups) before a risky change.
