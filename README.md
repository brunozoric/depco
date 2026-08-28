# Dependency Manager

A browser-based tool for managing npm dependencies across multiple local projects. React frontend + Fastify API backend with SQLite storage.

## Features

- **Multi-project management** — add, scan, and manage dependencies across yarn/npm/pnpm/bun projects from one dashboard
- **Dependency scanning** — workspace-aware scanning with registry lookups, upgrade classification (patch/minor/major), and prerelease filtering
- **Upgrade wizard** — step-by-step upgrade flow with branching, committing, and custom pre/post hooks
- **Security checks** — config-driven security field validation per package manager
- **Changelog viewer** — fetches changelogs from GitHub releases, CHANGELOG.md files, and npm readmes
- **Global package view** — cross-project package table with search, filters, sorting, and per-project upgrade actions
- **Vulnerability scanning** — npm audit + OSV.dev enrichment, dismiss/snooze/undismiss, CVSS detail, health score penalty, CSV/JSON export
- **License compliance** — license detection from npm registry metadata, risk tier classification, configurable policy rules (allow/warn/deny), violation tracking
- **SBOM export** — CycloneDX 1.5 and SPDX 2.3 format export per project or across all projects
- **Historical trends** — staleness, license compliance, auto-fix, and vulnerability trend charts with sparkline summary cards
- **Team ownership** — assign projects to teams, filter all views by team
- **Dependency graph** — interactive tree/graph view of project dependency trees with BFS path search
- **Auto-fix PRs** — automatic branch/commit/push/PR creation for eligible upgrades with license-deny filtering
- **Token encryption** — GitHub/GitLab API tokens encrypted at rest with AES-256-GCM + argon2id key derivation
- **Job system** — async job queue for scans, upgrades, installs, and clones with real-time WebSocket progress
- **Scheduled scans** — per-project scan intervals (6h/12h/24h/48h/weekly) with staggered boot recovery
- **File-based configuration** — `.dependency-upgrader.json` for step hooks and app settings, with UI going read-only when file config is active
- **Backup/restore** — export and import all data as a zip file
- **Application logging** — configurable log levels with real-time log browser

## Quick Start

```bash
yarn install

# Required for token encryption (GitHub/GitLab API keys)
cp .env.example .env
# Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Build and create the first admin user
yarn build
depco init

# Start the app
yarn dev
```

Opens at `http://localhost:5173` with API on port 3001. Login with the credentials you created during `depco init`.

## CLI Commands

| Command      | Description                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `depco init` | Create the first admin user. Prompts for email, display name, and password. Creates the database and runs migrations if needed. Exits if users already exist. |

## Development Commands

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `yarn dev`          | Start API + UI dev servers                         |
| `yarn build`        | Compile TypeScript + build UI                      |
| `yarn start`        | Production: serve API + static UI                  |
| `yarn test`         | Run test suite                                     |
| `yarn lint`         | Lint with oxlint                                   |
| `yarn format:check` | Check formatting with oxfmt                        |
| `yarn full`         | Full pipeline: adio + lint + format + build + test |
| `yarn changeset`    | Create a changeset for your changes                |

## Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and npm publishing.

1. After making changes, run `yarn changeset` to create a changeset (patch/minor/major + summary)
2. Push to main — CI runs, then the publish workflow creates a "chore: release" PR
3. Merging that PR bumps the version, updates `CHANGELOG.md`, and publishes to npm

Publishing is automated via GitHub Actions — never publish from a local machine. Requires `NPM_TOKEN` secret in the repo.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and PR guidelines. Forks are welcome if you need functionality specific to your use case.

## Support

See [SUPPORT.md](./SUPPORT.md) for bug reports, questions, feature requests, and security disclosures.

## License

[MIT](./LICENSE)
