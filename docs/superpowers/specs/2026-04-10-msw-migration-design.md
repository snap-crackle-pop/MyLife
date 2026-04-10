# MSW Migration Design

**Date:** 2026-04-10  
**Status:** Approved  

## Overview

Replace the current `vi.fn()` fetch stub approach with Mock Service Worker (MSW) for both integration (Vitest) and E2E (Playwright) tests. MSW intercepts requests at the network boundary using URL-matched handlers rather than ordered call stubs, making tests more readable and resilient to call-order changes.

## Current State

- Integration tests: `createMockFetch()` returns a `vi.fn()` stub; tests call `vi.stubGlobal('fetch', mockFetch)` and queue responses with `mockFetch.mockResolvedValueOnce(githubResponse(...))`.
- E2E tests: `page.route('https://api.github.com/**', handler)` with a data-driven `files: MockFile[]` array passed to `setupApp()`.
- Factories (`tests/factories.ts`) export `createMockFetch`, `githubResponse`, `githubError` — all removed after migration.

## File Structure

```
tests/mocks/
  handlers.ts            ← shared MSW HTTP handler definitions (URL-matched, Node-compatible)
  server.ts              ← setupServer(...handlers) for Vitest/Node
src/mocks/
  browser-handlers.ts    ← E2E handlers that read window.__mswFixtures
  browser.ts             ← setupWorker(...browserHandlers) for E2E/browser
public/
  mockServiceWorker.js   ← generated once: npx msw init public/
```

## Integration Layer (Vitest)

### handlers.ts

Defines URL-matched GitHub API handlers using `http` from `msw`. Covers:

- `GET https://api.github.com/repos/:owner/:repo/git/trees/:sha` → `listFiles`
- `GET https://api.github.com/repos/:owner/:repo/contents/:path` → `getFileContent`
- `PUT https://api.github.com/repos/:owner/:repo/contents/:path` → `createFile` / `updateFile`
- `DELETE https://api.github.com/repos/:owner/:repo/contents/:path` → `deleteFile`
- `GET https://api.github.com/repos/:owner/:repo` → `validateConnection` catch-all

Default responses are minimal happy-path stubs (empty tree, placeholder sha, etc.). Tests override specific handlers via `server.use()` for the response shape they need.

### server.ts

```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

### tests/setup.ts additions

```ts
import { server } from './mocks/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` catches accidental real network calls in tests.

### Per-test overrides

Replace `mockFetch.mockResolvedValueOnce(githubResponse(...))` with:

```ts
server.use(
  http.get('https://api.github.com/repos/*/git/trees/*', () =>
    HttpResponse.json({ tree: [...] })
  )
);
```

`server.resetHandlers()` in `afterEach` restores defaults automatically.

### Removals

- `createMockFetch` — deleted from `tests/factories.ts`
- `githubResponse` — deleted from `tests/factories.ts`
- `githubError` — deleted from `tests/factories.ts`
- `vi.stubGlobal('fetch', mockFetch)` — removed from all integration test files
- `mockFetch.mockReset()` / `mockFetch.mockResolvedValueOnce()` — removed from all integration test files

## E2E Layer (Playwright)

### Fixture bridge

MSW v2 handlers execute in the **page context** (not the service worker context), so they can read `window.__mswFixtures`. Playwright's `page.addInitScript()` seeds that global before any page scripts run — no race condition.

### browser-handlers.ts

Same four GitHub API route patterns as `handlers.ts`, but response data is read from `window.__mswFixtures`:

```ts
interface MockFile { path: string; content: string; sha: string; }

http.get('.../git/trees/:sha', () => {
  const files: MockFile[] = (window as any).__mswFixtures ?? [];
  return HttpResponse.json({
    tree: files.map(f => ({ path: f.path, type: 'blob', sha: f.sha }))
  });
}),
http.get('.../contents/:path', ({ params }) => {
  const files: MockFile[] = (window as any).__mswFixtures ?? [];
  const file = files.find(f => f.path === params.path);
  if (!file) return new HttpResponse(null, { status: 404 });
  return HttpResponse.json({ content: btoa(file.content), sha: file.sha });
}),
// PUT → { content: { sha: 'mock-sha' } }
// DELETE → 200 {}
// catch-all GET → 200 {}
```

### browser.ts

```ts
import { setupWorker } from 'msw/browser';
import { browserHandlers } from './browser-handlers';
export const worker = setupWorker(...browserHandlers);
```

### App registration (src/routes/+layout.svelte)

```ts
if (import.meta.env.DEV) {
  const { worker } = await import('../mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}
```

`onUnhandledRequest: 'bypass'` lets non-GitHub requests (SvelteKit HMR, static assets) pass through unmodified.

### E2E test helper changes

Replace `mockGitHub(page, files)` + `page.route(...)` with:

```ts
async function setupApp(page: Page, files: MockFile[] = []) {
  await page.addInitScript((data) => {
    (window as any).__mswFixtures = data;
  }, files);
  await page.goto('/');
  // rest of setup unchanged
}
```

All `page.route()` calls removed from every E2E spec file.

## Dependencies

```
msw  (v2, already peer-compatible with Vitest 4 + Playwright 1.58)
```

Install: `npm install --save-dev msw`  
Generate SW: `npx msw init public/ --save`

## Testing Strategy

No new test files. Migration touches:
- `tests/setup.ts` — server lifecycle
- `tests/factories.ts` — remove mock fetch helpers
- `tests/mocks/handlers.ts` — new file
- `tests/mocks/server.ts` — new file
- `src/mocks/browser-handlers.ts` — new file
- `src/mocks/browser.ts` — new file
- All `tests/integration/*.test.ts` — replace `mockFetch` usage with `server.use()`
- All `tests/e2e/*.spec.ts` — replace `page.route()` with `addInitScript` fixture seeding

After migration, `npm run validate` must pass with zero changes to test assertions — only the mocking mechanism changes, not what is tested.
