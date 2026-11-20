# ALLNEEDS — Project handoff

Written 20 Nov 2026 so a new conversation can continue without losing context.
Repository: `/home/erretby/ALLNEED-S` (branch `main`). The interface is in **French** (EN is a translation layer).
This file contains **no passwords**: see "Where the credentials are".

---

## 1. Product in one paragraph

ALLNEEDS is a SaaS for **healthcare facilities** (practices, centres, laboratories, allied health). Only the **Healthcare** sector is shown for now (Education and Tourism exist in the code but are hidden). Journey: a facility signs up on the public site → an admin assigns it a **concierge** → the director receives a link to create their password → 360° diagnostic → the concierge analyses and publishes a **report** → **offers** (BASIQUE/PRO/PERFORMANCE) → **missions** → "Needs" subscriptions (providers) and SaaS access. On top of that sit a **Sales Presentation** (sales pitch deck) and a full **CRM** (contacts, calls, appointments, campaigns, map).

---

## 2. Architecture

| Layer | Technology / file |
|---|---|
| Frontend | React 19 + Vite 8 + TanStack Router (file-based routes in `src/routes/`, tree generated in `src/routeTree.gen.ts` by `npm run routes:generate`) + Tailwind v4 |
| Backend | **Single Node HTTP server, no framework**: `backend/server.mjs` (~2700 lines) + `backend/crm.mjs` (CRM module) + `backend/sales-presentation.mjs` (pitch content) |
| Data | In-memory DB loaded at startup. **Source of truth = Supabase** (when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set), local copy `backend/data/db.json`. Without Supabase, everything is local. |
| Supabase | Tables `v46_*`. Core: `v46_organizations`, `v46_users`, `v46_concierge_organizations`, `v46_invitations`. "Collection" tables `(id, organization_id, payload jsonb)`: registrations, diagnostics, needs, missions, offers, documents, messages, appointments, quotes, notifications, needs_subscriptions, saas_subscriptions, conversations, diagnostic_consents. CRM: `v46_crm_*` (9 tables). RLS on, `service_role` only. |
| Sync | `saveDb()` writes `db.json` then queues `syncRemote()`: full upsert + **prune** (deletes rows absent from memory) for the classic tables; **incremental** for CRM tables (only changed rows, via `crmSynced`). CRM is synced **last** (a missing CRM table doesn't block the rest). |
| Auth | Signed HMAC session cookie (`allneeds_session`, HttpOnly, SameSite=Strict). Passwords hashed **scrypt** (`scrypt$salt$hex`). Invitations = single-use token, 48 h, hashed in the database. Login throttled (rate limit). |
| Sessions | **Sliding**: every authenticated request renews the cookie. Default length **720 h (30 days)** without activity (`ALLNEEDS_SESSION_TTL_HOURS`). The frontend pings `/api/me` every 15 min and when the tab regains focus. |
| Emails | Hand-written SMTP in `server.mjs` (`EMAIL_HOST/PORT/USER/PASS`). If sending fails, the APIs return a `setupUrl` link to pass on by hand. |
| Dev | `npm run dev:all` = backend (8787) + Vite (5173). Vite proxies `/api` → 127.0.0.1:8787. |

### Roles (`v46_users.role`)
| Role | Space | Access |
|---|---|---|
| `admin` | `/admin` (+ `/crm`) | Everything |
| `concierge` | `/concierge` | Only the companies assigned to them (`orgIds`). Can receive the `sales_presentation` permission. |
| `dirigeant`, `manager`, `collaborateur` | `/app` | Client space of their company. The director invites the team. |
| `sales` | `/sales-presentation` | **Only** `/api/sales/*` (blocked by the server everywhere else) |
| `agent` | `/crm` | **Only** `/api/crm/*`, limited scope (see CRM) |
| `crm` | `/crm` + `/sales-presentation` | Same CRM rights as an agent + Sales Presentation, nothing else |
| `prestataire` | `/expert` | Demo space, **no creation flow** |
| `commercial` | — | Legacy, unused |

Server-side gating: in `server.mjs`, right after `sessionUser(req)`: `sales` limited to `SALES_ALLOWED_API`, `agent` limited to `/api/crm/`, `crm` limited to `/api/crm/` + `/api/sales/`. Then `crm.handle()` takes the `/api/crm/*` routes.
Frontend: `workspacePathForRole()` (`src/features/auth/AuthContext.tsx`) sends each role to its space; `WorkspaceGate` / `src/routes/crm.tsx` guard the spaces.

### Frontend: shared building blocks
- `src/components/layouts.tsx`: `AppShell` (sidebar, top bar, theme, FR/EN switch, ⌘K search), variants `admin | concierge | client | crm`; navigations `buildAdminNav`, `buildConciergeNav`, `buildClientNav`, `buildCrmNav` (driven by the permissions returned by the server); `PageHeader` (gradient banner).
- `src/components/admin-kit.tsx`: `MiniStat`, `StatGrid`, `Panel`, `Rows`, `EmptyBox`, `LoadingRows`, `Initial`, `Segmented`, `SearchBox`, `HowItWorks`.
- `src/components/ui.tsx`: `Button`, `Input`, `Select`, `Modal`, `Badge`, `Alert`, `Field`, `Tabs`, `Steps`…
- `src/components/charts.tsx`: SVG charts without dependencies (`AreaChart`, `DonutChart`, `BarList`, `Legend`).
- `src/index.css`: layered styles **V5x** appended at the end (latest: V53 sales `sp-*`, V54 language switch, V55 concierge `cg-*`, V56 dark-mode fixes, V57 CRM `crm-*`). Dark mode = `.an-shell[data-mode="dark"]`.
- Theme: `src/lib/theme.ts` (localStorage key `an-theme`, palettes indigo/allneeds/emeraude/violet/corail/ocean).

### FR/EN translation (`src/i18n/`)
- French stays the source in the code. `src/i18n/index.ts` replaces **displayed text** (text nodes + placeholder/title/aria-label/alt) using `src/i18n/en.json` (`phrases` = exact match, `fragments` = substrings for template strings, ~5,500 entries). Patterns handled: numbers + text, "Label : value", "X sur Y", quotes «…», dates/months/abbreviated days.
- `en.json` is loaded lazily (separate chunk). `LanguageSwitch.tsx` = FR/EN switch (localStorage `allneeds-lang`). `t()` for `confirm/alert`.
- In dev, `window.__i18nMissing` lists untranslated texts. **Any new French text must be added to `en.json`.**
- Watch out for ambiguous French words (e.g. "Carte" = card/map, "Base" = basic/database): the CRM uses "Carte géographique" and "Base de contacts" to get the right translation.

---

## 3. What was done (chronological)

1. **Admin UI/UX overhaul** + modern dashboard (admin account given by the user; see §8).
2. **Fix: disconnected on refresh**: sliding session + `/api/me` on load.
3. **Healthcare only**: other sectors hidden (`src/lib/active-sectors.ts`).
4. **Sidebar & pages**: simplified UX, colours/themes, "dashboard" style (banner + stat cards + panels) on every admin page.
5. **Sales Presentation + `sales` role** (spec "Implement Sales Presentation Portal"):
   - `backend/sales-presentation.mjs` (8 sections, real content only), protected `GET /api/sales/presentation`.
   - Page `/sales-presentation` (`src/features/sales/SalesPresentation.tsx`): keyboard/swipe navigation, notes (N), full screen (F), progress bar.
   - Admin page `/admin/commerciaux` (invite sales accounts, enable/disable, grant the permission to a concierge).
   - Idempotent seed of the shared account `ALLNEEDS_SALES_EMAIL` (default `sales_presentation@gmail.com`) **only if** `ALLNEEDS_SALES_PASSWORD` is set (12+ characters).
   - Migration `database/migrations/2026-11-19-01-sales-role.sql`. Test `npm run test:sales`.
6. **Site-wide English**: FR/EN translation layer (above).
7. **SMTP**: Gmail rejects the credentials (error 535). The concierge invitation form now shows the **setup link** to pass on when the email fails. *(Still to fix on the user's side: new Gmail app password.)*
8. **Cloudflare tunnel removed**: `.env` points to `http://localhost:5173` (old `.env` backed up in the scratchpad of the previous session, not durable).
9. **Database**: `scripts/reset-database.mjs` (backup to `~/allneeds-backups/` then empties the tables and recreates the admins; requires `--yes` + backend stopped). Then the user created a **new Supabase project**. Setup files: `database/supabase.sql` (committed schema) and `database/allneeds-setup.local.sql` (schema + 2 admins, hashes only, **ignored by git**), `database/seed-admins.local.sql` (ignored).
10. **Concierge space redesign** (`/concierge`): new dashboard (greeting, KPIs, "To do now", portfolio), every page in the admin style, company detail page reworked, mobile.
11. **Dark-mode fixes**: Needs search, plan table and dropdown on `/admin/quotas`, readable `<option>`s, tables.
12. **Full CRM** (spec "Build a Complete CRM System"), see §4.
13. **`crm` role** = agent CRM rights + Sales Presentation.
14. **No more automatic disconnection** (30-day sliding sessions, all roles).
15. **Test accounts**: `scripts/create-test-accounts.mjs` (one account per role). Accounts created on the user's data, all verified (login 200).

---

## 4. CRM (detail)

### Backend: `backend/crm.mjs`
- `createCrm({ db, saveDb, json, readBody, audit, hashPassword, createInvitation, sendInvitationEmail, pushNotification })` → `{ handle }`, plugged into `server.mjs`.
- Collections: `crmDatabases, crmContacts, crmCalls, crmAppointments, crmCampaigns, crmZones, crmActivity, crmImports, crmSettings` ↔ tables `v46_crm_*`.
- **CRM roles** (`CRM_ROLES`): `admin` (all), `agent`, `crm` (non-admin = "field agents"). Adding a role = an entry in `CRM_ROLES` (+ its default permissions in the settings).
- **Permissions**: `AGENT_PERMISSIONS` (dashboard.view, contacts.view/create/edit/export, calls.create/edit, appointments.view/create/edit, map.view, campaigns.view, reports.view, notifications.view), configurable per role in **Settings → Permissions** and per user (`user.crm.permissions`). `ADMIN_PERMISSIONS` (users.manage, databases.manage, imports.run, campaigns.manage, zones.manage, agents.view, settings.manage, audit.view, geocode.run) are never grantable.
- **Agent scope**: contacts assigned to them **or** unassigned in their databases (`user.crm.databaseIds`); their own appointments/calls or those on visible contacts; their own campaigns and zones. Assignments are stored **on the user** (`user.crm.{databaseIds,campaignIds,zoneIds}`), a database's campaign on the database (`campaignId`).
- Statuses (fixed keys, editable labels): contact (new, not_contacted, contacted, interested, not_interested, callback_requested, appointment_booked, invalid_number, completed), call (+ called, answered, no_answer, busy…), appointment (pending, confirmed, completed, cancelled, rescheduled, no_show).
- Definitions: **reached** = call in {answered, callback_requested, interested, not_interested, appointment_booked, completed}; **conversion** = contacts with an appointment ÷ contacts called.
- Main routes (`/api/crm/...`): `me`, `lookups`, `stats`, `reports?type=calls|contacts|appointments|agents|databases|campaigns|zones|conversion|callbacks&compare=1`, `users` (+ `/:id`, `/:id/reset`, `/:id/activity`), `databases` (+ `/:id`, archive / `?hard=1`), `imports/check`, `imports`, `imports/:id/rows`, `imports/:id/complete|fail`, `contacts` (+ `export`, `bulk`, `/:id`, `/:id/notes`, `/:id/location`), `calls`, `appointments` (`all=1` for the calendar), `campaigns`, `zones`, `map`, `geocode`, `agents` (+ `/:id`), `notifications` (+ read, read-all, preferences), `settings`, `activity`.
- **Import**: the browser reads CSV (auto-detected separator) or **.xlsx** (`read-excel-file`), column mapping (synonyms), server validation (`/imports/check`), duplicates (phone/email, strategy skip/update/create), import in batches of 300 with progress, summary + history.
- Callback reminders: `setInterval` every minute → `callback.reminder` notification.
- **Geocoding**: OpenStreetMap Nominatim, **disabled by default** (Settings → Integrations), triggered by an admin, ~1 address/s. Coordinates are **never invented**; manual placement on the map.
- Calls: **no telephony**. Manual logging (`tel:` link). Structure ready for a connector.
- Audit log: `crmActivity` (capped at 50,000) + `audit.jsonl`.

### Frontend: `src/routes/crm*` and `src/features/crm/`
- `src/routes/crm.tsx`: guard (roles admin/agent/crm) + `CrmProvider` + `AppShell variant="crm"`.
- Pages: `crm/index` (dashboard), `utilisateurs`, `agents/index` + `agents/$id`, `bases/index` + `bases/$id`, `contacts/index` + `contacts/$id`, `appels`, `rendez-vous` (week/month/day calendar, list, map), `carte` (clustering, density, zones circle/polygon/cities), `campagnes/index` + `campagnes/$id`, `rapports` (CSV/Excel/PDF export via print), `notifications`, `reglages` (11 tabs + audit log).
- `src/features/crm/`: `core.tsx` (API, session, `FilterBar`, `DataTable`, pagination, statuses, CSV/Excel exports, `RequirePermission`), `forms.tsx` (contact, call, appointment, contact search), `ImportWizard.tsx`, `CrmMap.tsx` (Leaflet + markercluster), `permissions.ts` (labels).
- Libraries added: `leaflet 1.9.4`, `leaflet.markercluster 1.5.3`, `read-excel-file 9.3.19`, `write-excel-file 4.1.1` (+ `@types/leaflet*`).
- The admin menu has a **CRM** link; the CRM menu has "Sales Presentation" for roles that have access to it.

---

## 5. Files (main ones)

**Backend**: `backend/server.mjs` (CRM hookup, roles, sliding sessions, `lastLoginAt`, status suspended/inactive at login, incremental CRM sync), `backend/crm.mjs` (new), `backend/sales-presentation.mjs` (new).
**SQL**: `database/supabase.sql` (full schema: roles incl. `sales`, `agent`, `crm`; invitations incl. `sales`, `crm`; `v46_crm_*` tables + JSON indexes), `database/migrations/2026-11-19-01-sales-role.sql`, `database/migrations/2026-11-19-02-crm.sql` (idempotent, also includes the `crm` role), `database/*.local.sql` (git-ignored).
**Scripts**: `scripts/test-crm.mjs` (106 checks), `scripts/test-sales-access.mjs`, `scripts/reset-database.mjs`, `scripts/create-test-accounts.mjs`.
**Frontend**: `src/i18n/*`, `src/features/crm/*`, `src/routes/crm.tsx` + `src/routes/crm/*`, `src/features/sales/SalesPresentation.tsx`, `src/routes/sales-presentation.tsx`, `src/routes/admin/commerciaux.tsx`, `src/routes/concierge/*` (redesign), `src/features/concierge/ScopedSection.tsx`, `src/components/AdminRealConcierges.tsx` (setup link if email fails), `src/routes/admin/quotas.tsx`, `src/components/layouts.tsx`, `src/features/auth/AuthContext.tsx`, `src/routes/connexion.tsx`, `src/index.css`.
**Config**: `.env` (local), `.env.example`, `.gitignore` (+ `database/*.local.sql`, `test-accounts.local.md`), `package.json` (`test:sales`, `test:crm`).

### Git state at time of writing
Latest commits: `da25062 feat(crm)…`, `f150a1b concierge`, `a44b148 sales presentation`.
**Not committed yet** (18 files): `crm` role, 30-day sessions, test-account script, dark-mode/table fixes and related changes: `.env.example`, `.gitignore`, `backend/crm.mjs`, `backend/server.mjs`, `database/migrations/2026-11-19-02-crm.sql`, `database/supabase.sql`, `scripts/test-crm.mjs`, `scripts/create-test-accounts.mjs`, `src/components/layouts.tsx`, `src/features/auth/AuthContext.tsx`, `src/features/sales/SalesPresentation.tsx`, `src/routes/connexion.tsx`, `src/routes/crm.tsx`, `src/routes/crm/{bases/index,campagnes/index,carte}.tsx`, plus `backend/data/db.json` and `backend/data/audit.jsonl`.
⚠️ **`backend/data/db.json` and `audit.jsonl` are tracked by git** and contain real data (accounts, password hashes): **do not commit them** (ideally take them out of version control).

---

## 6. Bugs fixed (memorable)
- Logged out on refresh → session restored via `/api/me`; then automatic disconnection removed entirely (sliding sessions, 30 days).
- Broken accents ("SantÃ©") in `src/store/store.tsx` → repaired.
- Concierge invitation: the Gmail error blocked everything and the link was lost → link shown + "Copy" button.
- Dark mode: input nested inside the Needs search box, white table header/rows, invisible `<option>`s (white on white) → fixed (V56).
- Quotas: table cut off at 1440 px → layout stacks below 1536 px; icons on the cards.
- Notifications page: render loop (`setUnread` re-created) → stable `useCallback`.
- "Clear filters" counted view/scale as filters → display keys excluded.
- Supabase `PGRST205` (table `v46_crm_*` missing) → migration to run; CRM sync moved last so it doesn't block the rest.
- Wrong translations caused by French homonyms (Carte/Base) → explicit CRM labels.
- Sales deck: hash/slide sync, overflow at 1440×900, mobile.

---

## 7. Remaining tasks / points of attention
1. **Commit** the pending changes (without `backend/data/db.json` / `audit.jsonl`). Ideally `git rm --cached backend/data/db.json backend/data/audit.jsonl` + add them to `.gitignore`.
2. **Supabase**: make sure `database/migrations/2026-11-19-02-crm.sql` has been run on the **current** project (it's the version with the `crm` role); otherwise saving a `crm` account fails. Then `notify pgrst, 'reload schema';`.
3. **SMTP Gmail**: create a new **app password** (Google Account → Security → App passwords), put it in `EMAIL_PASS` without spaces, restart. Until then, invitations go through the link shown on screen.
4. `prestataire` role: no creation flow (demo expert space).
5. CRM: no real telephony (manual logging), no external heatmap (density = semi-transparent circles), PDF = browser print. Data is fully loaded in memory (fine up to tens of thousands of contacts; beyond that, plan for SQL pagination).
6. CRM "Agent" permissions = configurable; the `crm` role currently has the same as `agent`.
7. Every new French text → add the EN translation in `src/i18n/en.json` (check with `window.__i18nMissing` in dev).
8. `scripts/test-rbac-workflow.mjs.backup*`: leftover copies, can be cleaned up.
9. The old `.env` (Cloudflare) was only backed up in a temporary session folder: no longer available.

---

## 8. Where the credentials are (never in git)
- **Admins**: `alaouih556@gmail.com` and `allneedsadmin@gmail.com` (password given by the user in the previous conversation; in hashed form in Supabase).
- **Test accounts** (one per role, `test.<role>@allneeds.test`): passwords in **`test-accounts.local.md`** at the project root (git-ignored). Copy and paste them; don't retype them.
- `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLNEEDS_SESSION_SECRET`, `EMAIL_*`, `ALLNEEDS_ADMIN_*`, optionally `ALLNEEDS_SALES_PASSWORD`.

---

## 9. Useful commands

```bash
npm run dev:all                 # backend 8787 + frontend 5173
npm run routes:generate         # after adding/renaming a page in src/routes
npx tsc --noEmit -p .           # typecheck
npm run build                   # production build
```

Tests (each one runs an isolated backend on a temporary database, Supabase disabled):
```bash
npm run test:crm                # 106 CRM checks (roles, scope, import, calls, appointments, stats, reports…)
npm run test:sales
npm run test:backend
npm run test:phase4 && npm run test:phase5 && npm run test:phase6
node scripts/test-rbac-workflow.mjs
```

Accounts and database:
```bash
# One test account per role (backend running) — passwords → test-accounts.local.md
ADMIN_EMAIL='allneedsadmin@gmail.com' ADMIN_PASSWORD='<password>' node scripts/create-test-accounts.mjs

# Reset (backup then empty) — STOP the backend first
RESET_ADMINS="alaouih556@gmail.com,allneedsadmin@gmail.com" RESET_ADMIN_PASSWORD='<password>' node scripts/reset-database.mjs --yes
```

Supabase (SQL Editor): new project = `database/allneeds-setup.local.sql`; existing project = the migrations in `database/migrations/` in date order; then `notify pgrst, 'reload schema';`.

---

## 10. Conventions to keep
- The French text is the source; the EN translation goes in `en.json`.
- New styles: append a new "V5x" block at the end of `src/index.css`, `crm-*` / `cg-*` / `sp-*` prefixes, always with the dark variant `.an-shell[data-mode="dark"]`.
- Every permission check **on the server** (never rely only on hiding a button).
- No invented data: no fake statistics, no fake coordinates. Unfinished content is marked "à compléter / Contenu à valider".
- Passwords: scrypt via the existing helpers, never in clear text in logs/responses/git.
- Never commit `.env`, `*.local.sql`, `test-accounts.local.md`, `backend/data/*`.
