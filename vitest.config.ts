// Re-export the project's real Vitest config so a bare `vitest run` (no
// --config flag) behaves identically to `yarn test`. Without this file,
// Vitest falls back to vite.config.ts, which has no `resolve.conditions`
// and no `test.include` restriction — that causes the `#api/*`/`#shared/*`
// subpath imports to resolve against stale `dist/` output instead of `src/`,
// and lets compiled `dist/**/__tests__/**/*.test.js` artifacts get picked up
// as test files.
export { default } from "./testing/vitest.config.ts";
