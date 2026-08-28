# Contributing

Contributions are welcome! This guide covers how to set up the project and submit changes.

## Prerequisites

- Node.js >= 24
- Yarn 4 (corepack-managed via `packageManager` in package.json)

## Setup

```bash
git clone <your-fork-url>
cd dependency-upgrader
yarn install
cp .env.example .env
```

## Development Workflow

```bash
yarn dev          # Start API + UI dev servers
yarn test         # Run test suite
yarn full         # Full CI pipeline locally
```

## Before Submitting a PR

Run the full check suite — this is what CI runs:

```bash
yarn npm audit
yarn adio
yarn lint
yarn format:check
yarn build
yarn test
```

Or use the shortcut (includes auto-fix variants for lint/format):

```bash
yarn full
```

## Adding a Changeset

Every PR that changes user-facing behavior needs a changeset:

```bash
yarn changeset
```

This prompts you to select `patch`, `minor`, or `major` and write a summary. The changeset file is committed with your PR. When the PR merges, the automated release workflow consumes changesets and publishes to npm.

Skip the changeset for internal-only changes (CI config, docs, test-only fixes).

## Pull Request Guidelines

- Fork the repo and create your branch from `main`
- Keep PRs focused — one feature or fix per PR
- Use conventional commit style for PR titles (`feat:`, `fix:`, `refactor:`, etc.)
- Add tests for new functionality
- Include a changeset for user-facing changes
- Make sure the full CI pipeline passes

## Forking

If you need functionality specific to your use case that doesn't fit the project's scope, feel free to fork and adapt. The MIT license allows this.

## Code Style

- TypeScript with strict mode
- Formatting enforced by oxfmt
- Linting enforced by oxlint
- Named interfaces over inline types
- Object parameters for functions with 2+ parameters

## Route Handlers

Route handlers use `registerRoute` which provides typed `send` helpers:

```typescript
registerRoute(app, someRoute, {}, async (request, _reply, send) => {
  const result = await useCase.execute(request.params);
  return send.one({ result }); // wraps in { item: ... }
  // or send.list({ result });   // sends directly
  // or send.none({ result });   // sends { success: true }
});
```

Response types are derived from the route definition — no manual generics needed.
