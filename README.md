# Bugema Digital Campus — Admin Console

A browser console for the [Bugema University Digital Campus API](https://github.com/RonaldRonnie/BU-APP),
which lives in its own repository. This one holds only the console.

It covers every administrative surface the API exposes: accounts and roles,
the organisation hierarchy, academics, finance, campus services, student
life, health and safety, communication, and the platform's own audit trail.

It is **plain static files** — no build step, no `node_modules`, no bundler.
Open `index.html` from any web server and it runs. That is deliberate: the
thing an administrator has to host should not need a toolchain to deploy.

---

## Quick start

```bash
# 1. Point the console at your API
#    Edit config.js → apiBaseUrl   (or: cp config.local.js config.js)

# 2. Serve the folder with anything
python3 -m http.server 4173          # or: npx serve -l 4173
```

Open <http://localhost:4173>.

### Let the API accept the console

The API reads a single allowed origin from `CORS_ORIGIN`. Set it to wherever
you serve the console and restart the API:

```bash
CORS_ORIGIN=http://localhost:4173 npm run start:dev
```

If instead you serve both from one origin behind a reverse proxy (see
[Hosting](#hosting)), set `apiBaseUrl: '/api/v1'` in `config.js` and CORS
stops mattering at all.

### Signing in

Use any account that holds administrative permissions. With the development
seed (`npm run prisma:seed`) that is:

```
super.admin@example.bugema.test / ChangeMe123!
```

On a database with no SUPER_ADMIN yet, use **First-run setup** on the sign-in
screen. It calls `POST /auth/bootstrap-admin` with the `x-bootstrap-secret`
header, so it needs `BOOTSTRAP_ADMIN_SECRET` set on the API. It succeeds at
most once per database — unset the secret afterwards and set
`showBootstrap: false` in `config.js`.

---

## Configuration

Everything lives in `config.js`, which is loaded at runtime rather than
compiled in — so a deployed console can be re-pointed by editing one file.

| Key | Meaning |
|---|---|
| `apiBaseUrl` | API root including the version prefix, no trailing slash. `http://localhost:3000/api/v1`, or `/api/v1` when same-origin. |
| `institution` | Name shown in the sidebar and page titles. |
| `showBootstrap` | Show the first-run setup link on the sign-in screen. Turn off once an admin exists. |
| `defaultPageSize` | Rows per page in list views. The API caps this at 100. |

---

## What is in it

| Area | Screens |
|---|---|
| **Overview** | Dashboard (platform counts from `/admin/stats`), global search |
| **Identity & access** | Users, Roles, Permissions, Access matrix |
| **Organisation** | Faculties, Departments, Programmes |
| **Academics** | Courses + prerequisites, Course offerings, Enrolments, Timetable, Examinations + seat allocation, Attendance, Live lessons |
| **Finance** | Invoices, Payments, Stuck-payment triage, Scholarships, Document requests |
| **Campus services** | Campus map, Digital ID desk |
| **Library** | Books + copies, Authors, Categories, Loans |
| **Accommodation** | Hostels, Rooms & beds, Bed allocations, Room swaps, Maintenance, Visitor logs |
| **Student life** | Clubs + members, Events + hotseat Q&A, Alumni, Jobs board + applications |
| **Health & wellbeing** | Clinic appointments, Counselling, Safety alerts, Help desk |
| **Communication** | Conversations, Department channel, Emergency broadcast, Announcements, Worship services |
| **Platform** | Files, Audit trail, API health, API console, My account |

Three screens are worth calling out:

- **Access matrix** — a role × permission grid you tick and untick. The API
  checks permissions against the database on every request rather than
  trusting the JWT, so a change here applies on the holder's *next request*;
  nobody has to sign out.
- **Audit trail** — filterable by actor, action prefix, entity and date range,
  with CSV export. `action` is a case-insensitive prefix on the API side, so
  `auth.login` returns both `auth.login.success` and `auth.login.failed`.
- **API console** — sends any request to any path with your current token.
  It is the escape hatch for anything this UI does not model, so the console
  is never the reason something cannot be done.

---

## How it is built

```
bugema-admin-panel/
├── index.html           Shell
├── config.js            Runtime configuration (not compiled in)
├── assets/styles.css    One stylesheet, light + dark via CSS variables
└── js/
    ├── api.js           Fetch client: envelope unwrapping, token refresh
    ├── store.js         Session, effective permissions, lookup cache
    ├── router.js        Hash router (list state lives in the URL)
    ├── ui.js            DOM helpers, toasts, modals, drawers
    ├── fields.js        Form engine (field descriptor → input → payload)
    ├── lookups.js       Reference pickers (users, courses, departments, …)
    ├── enums.js         Enums mirrored from prisma/schema.prisma
    ├── format.js        Value formatting, CSV export, path building
    ├── resources/       One declarative descriptor per API module
    └── pages/           The generic resource engine + bespoke screens
```

Most screens are **configuration, not code**. A resource descriptor in
`js/resources/*.js` names its endpoints, columns, filters, form fields and
actions, and `js/pages/resource.js` renders the list, filters, pagination,
detail drawer, forms and nested collections from it. Adding an endpoint is
usually a config entry. Anything genuinely bespoke — the dashboard, the audit
trail, chat, the access matrix — gets its own module in `js/pages/`.

Three behaviours worth knowing:

- **Token refresh is single-flight.** When several requests hit an expired
  token at once, exactly one `/auth/refresh` goes out. A second would present
  an already-rotated token, and the API revokes the whole session family when
  that happens.
- **Permissions are advisory in the UI.** On sign-in the console reads
  `/roles` and computes your effective permission set, then dims what you
  cannot use. If your account cannot read `/roles`, it shows everything and
  lets the API answer — a limited operator gets a clear 403 instead of a
  mysteriously empty menu. The API is the only real gate either way.
- **List state is in the URL.** `#/users?status=ACTIVE&page=2` can be
  bookmarked, reloaded and shared, and Back does what you expect.

### Adding a screen

```js
// js/resources/<domain>.js
export const widgets = {
  key: 'widgets', label: 'Widgets', singular: 'Widget',
  group: 'Platform', icon: '🔩',
  list: {
    path: '/widgets',
    permission: 'widgets:read',
    searchable: true,
    filters: [{ name: 'status', label: 'Status', type: 'enum', options: ['ON', 'OFF'] }],
    columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }],
  },
  create: {
    path: '/widgets', permission: 'widgets:create',
    fields: [{ name: 'name', label: 'Name', type: 'text', required: true }],
  },
  update: { path: '/widgets/:id', permission: 'widgets:update', fields: [/* … */] },
  remove: { path: '/widgets/:id', permission: 'widgets:delete' },
};
```

Then add it to the `RESOURCES` array in `js/resources/index.js`. It appears in
the sidebar with a working list, filters, pagination, detail drawer and forms.

Field types: `text` `textarea` `email` `password` `number` `integer` `money`
`enum` `select` `multienum` `checkbox` `date` `datetime` `time` `ref` `refs`
`tags` `json` `static`. `ref`/`refs` are searching pickers backed by
`js/lookups.js`.

---

## Hosting

The console holds **no secrets and has no environment variables**. Everything
it needs is one line in `config.js`: the API's URL. The API's own environment
variables (`DATABASE_URL`, the JWT keys, `MFA_ENCRYPTION_KEY`,
`PAYMENT_WEBHOOK_SECRET`, the S3 credentials) belong only on the API host —
anything shipped to a browser is readable by anyone who opens DevTools. The
console authenticates as a person, with that person's password, and gets a
short-lived token like any other client.

So wherever you host it, the only two settings that matter are:

| Where | Setting | Value |
|---|---|---|
| `config.js` | `apiBaseUrl` | the API URL, e.g. `https://bu-app-t9gy.onrender.com/api/v1` |
| API host (Render) | `CORS_ORIGIN` | the console's own origin, e.g. `https://<owner>.github.io` |

`CORS_ORIGIN` accepts a **comma-separated list**, so the deployed console and
a developer's `http://localhost:4173` can both be allowed at once:

```
CORS_ORIGIN=https://ronaldronnie.github.io,http://localhost:4173
```

A single value behaves exactly as it always did. Omit trailing slashes —
a browser's `Origin` header never has one (the parser strips them anyway).

> **Requires the API side of this.** The list form is parsed by
> `parseCorsOrigin` in the API's `src/config/configuration.ts`. If your
> deployed API predates that change it reads `CORS_ORIGIN` as one literal
> origin, and a comma-separated value will match nothing at all. Either deploy
> that change or set a single origin here.

### Option A — Render Static Site (recommended)

Render static sites support **rewrite** rules that proxy to an external URL.
Pointing `/api/*` at the API puts the console and the API on one origin, so
CORS never applies and you never have to keep `CORS_ORIGIN` in step with the
console's URL.

[`render.yaml`](render.yaml) declares this. Via the dashboard, the equivalent
manual settings are:

| Field | Value |
|---|---|
| Service type | Static Site |
| Build command | *(leave empty, or `echo nothing to build`)* |
| Publish directory | `.` (repository root) |
| Environment variables | *none* |
| Redirect/Rewrite | Source `/api/*` → Destination `https://bu-app-t9gy.onrender.com/api/*`, Action **Rewrite** |

Then set `apiBaseUrl: '/api/v1'` in `config.js`.

Note Render applies a rule only when no file exists at that path, so `/api/*`
never collides with the console's own files.

### Option B — GitHub Pages

Also fine: the console is static, uses a hash router (no SPA rewrite rules
needed) and references all its files relatively, so it works from a project
subpath like `https://<owner>.github.io/BU-APP/`.

Pages cannot serve a subdirectory on its own, so
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
publishes it. One-time setup:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Then:

1. `apiBaseUrl: 'https://bu-app-t9gy.onrender.com/api/v1'` in `config.js`
2. On Render, add the Pages origin to `CORS_ORIGIN`:
   `https://<owner>.github.io` — the **origin only**, no repository path
3. Redeploy the API so the new value is picked up

The trade-off against Option A is that CORS is now load-bearing: the console
and API are on different origins, and a change to either URL means updating
`CORS_ORIGIN` too.

### Either way

- **The repository is public, so the console's URL is public.** That is not a
  secret leak — it contains no credentials and every call needs a valid token
  — but it does advertise the admin surface, and neither host offers IP
  allowlisting or a password in front of the page. If you want the console
  reachable only by staff, put it behind something that can authenticate at
  the edge (Cloudflare Access, a VPN, or a private host).
- **Free-tier cold starts.** A Render free instance idles out and takes most
  of a minute to answer its first request. The sign-in screen says so after
  six seconds rather than looking frozen; a paid instance removes the wait.
- **Keep the API's `/api/docs` in mind.** Swagger is served from the API's own
  origin, so it is unaffected by any of the above.

## Notes and limits

- **Sensitive records.** Opening another person's clinic or counselling record
  is audited as `health.record_accessed` / `counseling.record_accessed` by the
  API *before* the response is returned. Those screens say so on the page.
- **Department channel.** It always follows your own `departmentId`, re-checked
  on every read and write. An administrator with no department sees an
  explanation rather than a channel; to administer someone else's, use the
  Channel members tab under **Departments**.
- **Files.** Upload under **Files**, then paste the returned asset ID wherever
  a `fileAssetId` is asked for (announcements, maintenance requests, document
  requests). The API never takes raw bytes anywhere else. 20 MB cap.
- **Tokens** are kept in `localStorage`, so the console assumes a trusted
  administrator device. Use **My account → Sign out everywhere** if one is lost.
- **`config.local.js`** is a convenience copy pointing at `http://localhost:3000`.
  `cp config.local.js config.js` to work locally; `config.js` stays pointed at
  the deployed API so a fresh checkout deploys correctly by default.
- **Two endpoints take no pagination parameters** (`/departments`, `/programs`)
  because their query DTOs do not extend `PaginationQueryDto`, and the API
  rejects unknown query keys. They are declared `paginated: false`; keep that
  in mind if you add filters to them.
- **No WebSocket use.** Chat screens poll on open and on send rather than
  subscribing to the gateway. Fine for administration; not a live chat client.
