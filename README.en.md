# Incident Intelligence Platform

🌐 English (current) · [Português](README.md)

**Incident-driven operational knowledge base.** A "Notion for operations": log incidents while the emergency is happening, turn them into reviewed knowledge base articles, and find solutions fast the next time it happens.

<!-- Dynamic badges: values are read live from the repository. -->
[![CI](https://img.shields.io/github/actions/workflow/status/janeiaraujo/knowledgebase/ci.yml?branch=main&style=flat-square&color=0aa344&label=build)](https://github.com/janeiaraujo/knowledgebase/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/package-json/v/janeiaraujo/knowledgebase?filename=backend%2Fpackage.json&style=flat-square&color=0aa344&label=version)](backend/package.json)
[![Latest release](https://img.shields.io/github/v/release/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=release)](https://github.com/janeiaraujo/knowledgebase/releases)
[![License](https://img.shields.io/github/license/janeiaraujo/knowledgebase?style=flat-square&color=0aa344)](LICENSE)
[![Stars](https://img.shields.io/github/stars/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=stars)](https://github.com/janeiaraujo/knowledgebase/stargazers)
[![Issues](https://img.shields.io/github/issues/janeiaraujo/knowledgebase?style=flat-square&color=0aa344)](https://github.com/janeiaraujo/knowledgebase/issues)
[![Contributors](https://img.shields.io/github/contributors/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=contributors)](https://github.com/janeiaraujo/knowledgebase/graphs/contributors)
[![Last commit](https://img.shields.io/github/last-commit/janeiaraujo/knowledgebase?style=flat-square&color=0aa344&label=last%20commit)](https://github.com/janeiaraujo/knowledgebase/commits/main)

[![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20React%20%7C%20MongoDB-informational?style=flat-square)](#stack)
[![Author](https://img.shields.io/badge/author-Janei%20Araujo-0aa344?style=flat-square)](https://github.com/janeiaraujo)

> **Status:** actively developed. The API may have breaking changes between versions.

---

## Screenshots

<table>
<tr>
<td width="50%">

**Quick Capture** — text, voice, logs and images; AI generates the article
<img src="docs/screenshots/quick-capture.png" alt="Quick Capture screen, with problem, solution, logs and image upload fields">

</td>
<td width="50%">

**Incidents** — full lifecycle: open → acknowledged → resolved
<img src="docs/screenshots/incidents.png" alt="Incident list with severity, status and origin (manual or automatic)">

</td>
</tr>
<tr>
<td width="50%">

**Knowledge Base** — article library with review workflow
<img src="docs/screenshots/kb-list.png" alt="KB list with draft, in-review and published status">

</td>
<td width="50%">

**KB article** — generated from an incident, ready for review
<img src="docs/screenshots/kb-view.png" alt="A KB article in review">

</td>
</tr>
<tr>
<td width="50%">

**Smart Search** — combines full-text, semantic search (AI) and problem analysis
<img src="docs/screenshots/smart-search.png" alt="Smart search screen">

</td>
<td width="50%">

**Post-mortem** — Google SRE, Netflix and AWS Well-Architected templates
<img src="docs/screenshots/postmortem.png" alt="Post-mortem creation modal with templates">

</td>
</tr>
</table>

---

## Table of contents

- [Screenshots](#screenshots)
- [Key features](#key-features)
- [Stack](#stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Optional integrations](#optional-integrations)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Versioning](#versioning)
- [Contributors](#contributors)
- [Author](#author)
- [License](#license)

---

## Key features

- **Fast incident logging** — capture during the emergency, structure it afterward.
- **Full-text and semantic search** — MongoDB full-text index, with similarity search when AI is enabled.
- **Review workflow** — the author doesn't approve their own article; draft → review → published.
- **Multi-tenant** — data isolation per organization across every query.
- **Access control** — roles, departments, groups and per-knowledge-base permissions.
- **Post-mortem and RCA** — structured templates, timeline and 5 Whys.
- **Event ingestion** — endpoint for Zabbix, Grafana and similar, via API token.
- **Versioning and audit** — change history and audit trail.
- **File uploads** — local disk by default, or Cloudflare R2 when configured.

## Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js 18+, Fastify 4, MongoDB 7, JWT |
| Frontend | React 18, Vite 5, Bootstrap 5, React Router 6 |
| Local infra | Docker Compose (MongoDB) |
| Optional | OpenAI, Cloudflare R2, SMTP |

---

## Getting started

### I just want to see it running

```bash
git clone https://github.com/janeiaraujo/knowledgebase.git
cd knowledgebase
docker compose up -d
docker compose --profile demo run --rm seed   # demo data
```

Open **http://localhost:8080** and sign in with `demo@incidentkb.com` / `demo123`.

This brings up MongoDB, the API and the UI — the UI is served by nginx, which
proxies `/api` and the WebSocket, so port 8080 is the only one you need.

> This compose file is for evaluation and local use. Before exposing it to any
> network, change `JWT_SECRET` and `JWT_REFRESH_SECRET` — see
> [SECURITY.md](SECURITY.md).

To develop with hot reload, follow the steps below.

### Prerequisites

- **Node.js 22+** ([nodejs.org](https://nodejs.org)) — the backend runs on 18+, but the frontend's Vite 8 requires `^20.19.0` or `>=22.12.0`
- **Docker** ([docs.docker.com](https://docs.docker.com/get-docker/)) — for local MongoDB
- **Git**

> Prefer not to use Docker? See [Using MongoDB Atlas](#using-mongodb-atlas-alternative).

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/janeiaraujo/knowledgebase.git
cd knowledgebase

# 2. Start MongoDB
docker compose up -d

# 3. Configure and prepare the backend
cd backend
cp .env.example .env
npm install
npm run migrate   # creates the database indexes
npm run seed      # populates demo data
npm start

# 4. In another terminal, the frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**.

### Demo credentials

`npm run seed` creates a sample organization with 3 knowledge bases:

```
E-mail: demo@incidentkb.com
Password: demo123
```

> ⚠️ These are development-only credentials. **Never** use this seed in production.

### Verifying the installation

```bash
curl http://localhost:3000/health
```

---

## Configuration

All configuration lives in `backend/.env` (see `backend/.env.example`). Only four variables are required:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string. Default: `mongodb://localhost:27017/incident_intelligence` |
| `JWT_SECRET` | Signing secret for the access token |
| `JWT_REFRESH_SECRET` | Signing secret for the refresh token |
| `FRONTEND_URL` | Frontend origin, used for CORS |

Generate secure secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> 🔒 `.env` is in `.gitignore`. **Never** commit real credentials — including in documentation files.

### Using MongoDB Atlas (alternative)

Create a free cluster, allow your IP under **Network Access**, and set:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/incident_intelligence?retryWrites=true&w=majority
```

---

## Optional integrations

The system boots and works **without any** of these. Each one enables a specific feature:

| Integration | Without it | Variables |
|---|---|---|
| **OpenAI** | AI routes return `503`; everything else works | `OPENAI_API_KEY` |
| **Cloudflare R2** | Uploads go to `backend/uploads/` | `R2_*` |
| **SMTP** | Magic link unavailable; password login still works | `SMTP_*` |
| **Asaas** | Billing features disabled | `ASAAS_*` |

---

## Available scripts

### Backend (`cd backend`)

| Command | Description |
|---|---|
| `npm start` | Starts the API at `http://localhost:3000` |
| `npm run dev` | Starts with hot reload (`node --watch`) |
| `npm run migrate` | Creates/updates MongoDB indexes (idempotent) |
| `npm run seed` | Populates demo data |
| `node scripts/seed-sample-data.js` | Populates extra sample KBs, incidents and events (idempotent per data type) |
| `npm test` | Smoke test: boots the real API and checks boot, `/health`, login and a protected route |

> ⚠️ `seed` is **additive**: running it again duplicates the sample data. Only run it against an empty database.
> `scripts/seed-sample-data.js` checks before inserting (skips KBs/incidents if the tenant already has them), so it's safe to run more than once.

### Frontend (`cd frontend`)

| Command | Description |
|---|---|
| `npm run dev` | Development server at `http://localhost:5173` |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves the build locally |

### Docker

| Command | Description |
|---|---|
| `docker compose up -d` | Starts MongoDB |
| `docker compose --profile tools up -d` | Also starts Mongo Express (`http://localhost:8081`) |
| `docker compose down` | Stops the containers (keeps the data) |
| `docker compose down -v` | Stops and **deletes** the database data |

---

## Project structure

```
.
├── backend/
│   └── src/
│       ├── db/indexes.js     # Index definitions (used on boot and by migrate)
│       ├── middlewares/      # Authentication, tenant, RBAC
│       ├── modules/          # One directory per domain (auth, records, kb, ai, ...)
│       ├── seeds/            # Migrate and seed scripts
│       ├── utils/            # Shared helpers
│       └── server.js         # Fastify bootstrap
├── frontend/
│   └── src/
│       ├── components/       # Reusable components
│       ├── contexts/         # Global state (Context API)
│       ├── pages/            # Application screens
│       └── services/         # HTTP client
└── docker-compose.yml
```

Each backend module follows the `<domain>.routes.js` pattern and, where there's relevant business logic, `<domain>.service.js`.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, coding standards and how to report bugs.

If this project helped you, consider leaving a ⭐ — it's what grows its reach.

[![Stars over time](https://img.shields.io/github/stars/janeiaraujo/knowledgebase?style=social)](https://github.com/janeiaraujo/knowledgebase/stargazers)

## Versioning

Follows [SemVer](https://semver.org/). The version lives in two places that must always match: `backend/package.json` and `frontend/package.json` — CI fails the build if they diverge.

Tagging and [releases](https://github.com/janeiaraujo/knowledgebase/releases) are automatic: merging a PR that bumps the version triggers `.github/workflows/release.yml`, which creates the `vX.Y.Z` tag and publishes a release using the matching section of [CHANGELOG.md](CHANGELOG.md) as the body — nothing to do by hand. If the CHANGELOG has no section for that version yet, the workflow warns and falls back to notes generated from the commits. The "version" badge at the top reads `backend/package.json` live; the "release" badge reads the latest published tag.

Two guards keep releases from falling behind: CI **warns** (without blocking) when a PR changes product code without bumping the version, and the `release-drift.yml` workflow keeps an issue open while `main` is ahead of the latest tag — closing it automatically once the release ships.

To ship a new version: bump both `package.json` files in the same PR, following the type of change (`patch` for a fix, `minor` for a backward-compatible feature, `major` for a breaking change), and merge — the rest is automatic.

### `main` branch protection

Direct pushes to `main` are blocked. Every change goes through a pull request requiring: 1 approval, all 3 CI checks green, the branch up to date with `main`, and conversations resolved. Force pushes and branch deletion are blocked.

### Known technical debt: React Router

The [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) advisory (CSRF in RSC mode) shows up for `react-router` 7.x and is only fixed in 8.3.0. **It does not apply to this project**: the advisory states it only affects applications using the unstable RSC APIs, and this app is a client-side SPA that uses none of them.

Applying it isn't a dependency bump — `react-router@8` requires React >= 19.2.7, and this project is on React 18. It would be a full framework migration. Revisit when we move to React 19; until then the alert is dismissed in Dependabot as "vulnerable code is not used".

## Contributors

Thanks to everyone who has contributed to this project:

<!-- Auto-updated from the repository's contributors. -->
[![Contributors](https://contrib.rocks/image?repo=janeiaraujo/knowledgebase)](https://github.com/janeiaraujo/knowledgebase/graphs/contributors)

## Author

**Janei Araujo** — [@janeiaraujo](https://github.com/janeiaraujo)

## License

Distributed under the **GNU AGPL-3.0-or-later** license. See [LICENSE](LICENSE).

The API ships interactive docs at **`/docs`** (OpenAPI 3.1). With the compose
setup that is http://localhost:8080/docs — the raw spec lives at `/docs/json`.
Set `DOCS_ENABLED=false` to keep the route inventory private.

Found a security issue? Please do not open a public issue — see [SECURITY.md](SECURITY.md). This project follows the Contributor Covenant [Code of Conduct](CODE_OF_CONDUCT.md).

In short: you can use, modify and redistribute the project, including commercially. However, **if you run it as a network-accessible service**, you must make the source code of your modified version available to that service's users.
