# URL Routing for Folder Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory `selectedFolder` state with URL-based routing so refreshing the page restores the selected folder.

**Architecture:** A SvelteKit route group `(app)` provides a shared layout (Sidebar, app shell) for two child pages: the empty home page and a catch-all `[...path]` folder page. `selectedFolder` is derived from `page.params.path` (SvelteKit route params) rather than a store. The existing `fallback: '404.html'` in `svelte.config.js` already handles GitHub Pages deep links with no additional config.

**Tech Stack:** SvelteKit 2 routing, Svelte 5 runes, `$app/navigation` (`goto`), `$app/state` (`page`), `$app/paths` (`base`), Playwright E2E

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/routes/(app)/+layout.svelte` | Sidebar, drawer backdrop, `.app`/`.main` wrappers, folder navigation |
| Create | `src/routes/(app)/+page.svelte` | Empty home state (no folder selected) |
| Create | `src/routes/(app)/[...path]/+page.svelte` | Folder view: mobile header, all interaction state, FolderPanel |
| Delete | `src/routes/+page.svelte` | Replaced by the three files above |
| Modify | `src/lib/stores/ui.svelte.ts` | Remove `selectedFolder`, `getSelectedFolder`, `setSelectedFolder` |
| Create | `tests/e2e/url-routing.spec.ts` | E2E: URL updates on select, refresh restores folder, unknown path redirects, back/forward |

---

## Task 1: Write failing E2E tests for URL routing

**Files:**
- Create: `tests/e2e/url-routing.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

interface MockFile {
	path: string;
	content: string;
	sha: string;
}

async function mockGitHub(page: Page, files: MockFile[] = []) {
	await page.route('https://api.github.com/**', (route) => {
		const url = route.request().url();
		const method = route.request().method();

		if (url.includes('/git/trees/main')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					tree: files.map((f) => ({ path: f.path, type: 'blob', sha: f.sha }))
				})
			});
		}
		if (method === 'GET' && url.includes('/contents/')) {
			const urlObj = new URL(url);
			const filePath = urlObj.pathname.split('/contents/')[1];
			const file = files.find((f) => f.path === filePath);
			if (file) {
				return route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ content: btoa(file.content), sha: file.sha })
				});
			}
			return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
		}
		if (method === 'PUT') {
			return route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ content: { sha: 'created-sha' } })
			});
		}
		if (method === 'DELETE') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
}

async function setupApp(page: Page, files: MockFile[] = []) {
	await mockGitHub(page, files);
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
	await page.fill('input[type="password"]', 'fake-token');
	await page.fill('input[type="text"]', REPO);
	await page.getByRole('button', { name: /connect/i }).click();
	await page.waitForURL('/', { timeout: 10_000 });
	await expect(page.locator('.loading'))
		.not.toBeVisible({ timeout: 5000 })
		.catch(() => {});
}

test.describe('URL routing', () => {
	test('selecting a folder updates the URL', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);
		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();
		await expect(page).toHaveURL(/\/inbox/);
	});

	test('refresh at a folder URL restores the selected folder', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);
		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();
		await expect(page).toHaveURL(/\/inbox/);

		await page.reload();
		await page.waitForURL(/\/inbox/, { timeout: 10_000 });
		await expect(page.locator('.loading'))
			.not.toBeVisible({ timeout: 5000 })
			.catch(() => {});
		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible({ timeout: 5000 });
	});

	test('navigating to an unknown folder URL redirects to root', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);
		await page.goto('/does-not-exist');
		await page.waitForURL('/', { timeout: 10_000 });
		await expect(page.getByText(/select a folder or create one/i)).toBeVisible();
	});

	test('back button returns to the previous folder', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'gk-1' },
			{ path: 'work/index.md', content: '', sha: 'gk-2' }
		]);

		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();
		await expect(page).toHaveURL(/\/inbox/);

		await page.locator('[data-folder]').filter({ hasText: 'work' }).click();
		await expect(page).toHaveURL(/\/work/);

		await page.goBack();
		await expect(page).toHaveURL(/\/inbox/);
		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible();
	});
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx playwright test tests/e2e/url-routing.spec.ts
```

Expected: All 4 tests FAIL (folder clicks don't change the URL yet)

---

## Task 2: Remove `selectedFolder` from `ui.svelte.ts`

The URL owns folder selection state — the store no longer needs it.

**Files:**
- Modify: `src/lib/stores/ui.svelte.ts`

- [ ] **Step 1: Replace the entire file**

```ts
let sidebarOpen = $state(false);
let sidebarCollapsed = $state(false);

export function getSidebarOpen() {
	return sidebarOpen;
}

export function setSidebarOpen(open: boolean) {
	sidebarOpen = open;
}

export function getSidebarCollapsed() {
	return sidebarCollapsed;
}

export function toggleSidebarCollapsed() {
	sidebarCollapsed = !sidebarCollapsed;
}
```

Note: `src/routes/+page.svelte` still imports `getSelectedFolder`/`setSelectedFolder`, so TypeScript will error. That's expected — it's deleted in Task 6.

---

## Task 3: Create `(app)/+layout.svelte`

The app shell shared by both the home page and all folder pages: Sidebar, drawer backdrop, container layout, and folder navigation handlers.

**Files:**
- Create: `src/routes/(app)/+layout.svelte`

- [ ] **Step 1: Write the file**

```svelte
<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { getFolderTree, createFolder } from '$lib/stores/notes.svelte';
	import { getSidebarOpen, setSidebarOpen } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	let folders = $derived(getFolderTree());
	let selectedFolder = $derived((page.params as { path?: string }).path ?? null);
	let sidebarOpen = $derived(getSidebarOpen());

	async function handleCreateFolder(name: string) {
		await createFolder(name);
		setSidebarOpen(false);
		goto(`${base}/${name}`);
	}

	function handleSelectFolder(path: string) {
		setSidebarOpen(false);
		goto(`${base}/${path}`);
	}
</script>

<div class="app">
	<Sidebar
		{folders}
		{selectedFolder}
		isOpen={sidebarOpen}
		onselectfolder={handleSelectFolder}
		oncreatefolder={handleCreateFolder}
		onclose={() => setSidebarOpen(false)}
	/>

	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="drawer-backdrop" onclick={() => setSidebarOpen(false)}></div>
	{/if}

	<main class="main">
		{@render children()}
	</main>
</div>

<style>
	.app {
		display: flex;
		height: 100dvh;
		overflow: hidden;
	}

	.main {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.drawer-backdrop {
		display: none;
	}

	@media (max-width: 768px) {
		.app {
			flex-direction: column;
		}

		.main {
			overflow-y: auto;
		}

		.drawer-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.4);
			z-index: 99;
		}
	}
</style>
```

---

## Task 4: Create `(app)/+page.svelte` (empty home state)

Shown at `/` when no folder is selected.

**Files:**
- Create: `src/routes/(app)/+page.svelte`

- [ ] **Step 1: Write the file**

```svelte
<script lang="ts">
	import { setSidebarOpen } from '$lib/stores/ui.svelte';
</script>

<div class="mobile-header">
	<button class="hamburger" onclick={() => setSidebarOpen(true)} aria-label="Open folders">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="21" y2="18" />
		</svg>
	</button>
	<span class="app-title">MyLife</span>
</div>

<div class="empty-state">
	<p>Select a folder or create one to get started.</p>
</div>

<style>
	.mobile-header {
		display: none;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 14px;
	}

	@media (max-width: 768px) {
		.mobile-header {
			display: flex;
			align-items: center;
			gap: 12px;
			height: 48px;
			padding: 0 4px 0 0;
			background: var(--bg-overlay);
			border-bottom: 1px solid var(--border);
			flex-shrink: 0;
		}

		.hamburger {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 44px;
			color: var(--text-secondary);
			border-radius: var(--radius);
		}

		.hamburger:hover {
			background: var(--bg-surface);
			color: var(--text-primary);
		}

		.app-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--text-primary);
			flex: 1;
		}
	}
</style>
```

---

## Task 5: Create `(app)/[...path]/+page.svelte` (folder view)

Handles all folder URLs (`/inbox`, `/work/projects`, etc.). Reads `page.params.path`, validates it against the loaded folder tree (redirecting to `/` if not found), and renders the mobile header with full interaction state plus `FolderPanel`.

**Files:**
- Create: `src/routes/(app)/[...path]/+page.svelte`

- [ ] **Step 1: Write the file**

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import FolderPanel from '$lib/components/FolderPanel.svelte';
	import type { Folder } from '$lib/types';
	import {
		getFolderTree,
		getFolderNote,
		updateNote,
		renameFolder,
		deleteFolder,
		createFolder
	} from '$lib/stores/notes.svelte';
	import { setSidebarOpen } from '$lib/stores/ui.svelte';

	let selectedFolder = $derived(page.params.path);
	let folders = $derived(getFolderTree());
	let folderNote = $derived(getFolderNote(selectedFolder));

	let renaming = $state(false);
	let renameName = $state('');
	let confirming = $state(false);
	let addingSubfolder = $state(false);
	let subfolderName = $state('');

	function folderExists(tree: Folder[], path: string): boolean {
		for (const f of tree) {
			if (f.path === path) return true;
			if (folderExists(f.children, path)) return true;
		}
		return false;
	}

	// Redirect to root if the folder no longer exists (e.g. deleted, or stale URL)
	$effect(() => {
		if (!folderExists(folders, selectedFolder)) {
			goto(`${base}/`);
		}
	});

	// Reset interaction state when navigating to a different folder
	let prevFolder = '';
	$effect(() => {
		if (selectedFolder !== prevFolder) {
			renaming = false;
			confirming = false;
			addingSubfolder = false;
			prevFolder = selectedFolder;
		}
	});

	function startRename() {
		renameName = selectedFolder.split('/').pop() ?? '';
		renaming = true;
		confirming = false;
		addingSubfolder = false;
	}

	function confirmRename() {
		const name = renameName.trim();
		if (name && name !== selectedFolder.split('/').pop()) handleRename(name);
		renaming = false;
	}

	function cancelRename() {
		renaming = false;
	}

	function startDelete() {
		confirming = true;
		renaming = false;
		addingSubfolder = false;
	}

	function cancelDelete() {
		confirming = false;
	}

	async function confirmDelete() {
		confirming = false;
		await handleDelete(selectedFolder);
	}

	function startAddSubfolder() {
		addingSubfolder = true;
		subfolderName = '';
		renaming = false;
		confirming = false;
	}

	function cancelAddSubfolder() {
		addingSubfolder = false;
	}

	async function confirmAddSubfolder() {
		const name = subfolderName.trim();
		addingSubfolder = false;
		if (name) {
			const path = `${selectedFolder}/${name}`;
			await createFolder(path);
			goto(`${base}/${path}`);
		}
	}

	async function handleRename(newName: string) {
		const parts = selectedFolder.split('/');
		const fullNewPath =
			parts.length > 1 ? `${parts.slice(0, -1).join('/')}/${newName}` : newName;
		await renameFolder(selectedFolder, fullNewPath);
		goto(`${base}/${fullNewPath}`);
	}

	async function handleDelete(folder: string) {
		await deleteFolder(folder);
		goto(`${base}/`);
	}

	async function handleSave(content: string) {
		const note = getFolderNote(selectedFolder);
		if (!note) return;
		await updateNote(note.path, content);
	}

	const folderDisplayName = $derived(selectedFolder.split('/').pop() ?? '');
	const selectedIsTopLevel = $derived(!selectedFolder.includes('/'));
</script>

<div class="mobile-header">
	<button class="hamburger" onclick={() => setSidebarOpen(true)} aria-label="Open folders">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="21" y2="18" />
		</svg>
	</button>

	{#if renaming}
		<input
			class="mobile-rename-input"
			value={renameName}
			oninput={(e) => (renameName = (e.target as HTMLInputElement).value)}
			onkeydown={(e) => {
				if (e.key === 'Enter') confirmRename();
				if (e.key === 'Escape') cancelRename();
			}}
			onblur={cancelRename}
		/>
		<button
			class="header-icon-btn confirm"
			onmousedown={(e) => e.preventDefault()}
			onclick={confirmRename}
			aria-label="Confirm rename"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
		</button>
		<button class="header-icon-btn" onclick={cancelRename} aria-label="Cancel rename">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	{:else}
		<span class="app-title" role="heading" aria-level="2">{folderDisplayName}</span>
		{#if !confirming && !addingSubfolder}
			<button class="header-icon-btn" onclick={startRename} aria-label="Rename">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
			</button>
			{#if selectedIsTopLevel}
				<button class="header-icon-btn" onclick={startAddSubfolder} aria-label="Add sub-folder">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
						/>
						<line x1="12" y1="11" x2="12" y2="17" />
						<line x1="9" y1="14" x2="15" y2="14" />
					</svg>
				</button>
			{/if}
			<button class="header-icon-btn danger" onclick={startDelete} aria-label="Delete">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
					<path d="M10 11v6" />
					<path d="M14 11v6" />
					<path d="M9 6V4h6v2" />
				</svg>
			</button>
		{/if}
	{/if}
</div>

<FolderPanel
	folder={selectedFolder}
	note={folderNote}
	{renaming}
	{renameName}
	{confirming}
	{addingSubfolder}
	{subfolderName}
	onstartrename={startRename}
	onstartdelete={startDelete}
	onstartaddsubfolder={startAddSubfolder}
	onrenameinput={(v) => (renameName = v)}
	onconfirmrename={confirmRename}
	oncancelrename={cancelRename}
	onconfirmdelete={confirmDelete}
	oncanceldelete={cancelDelete}
	onsubfolderinput={(v) => (subfolderName = v)}
	onconfirmsubfolder={confirmAddSubfolder}
	oncancelsubfolder={cancelAddSubfolder}
	onsave={handleSave}
/>

<style>
	.mobile-header {
		display: none;
	}

	@media (max-width: 768px) {
		.mobile-header {
			display: flex;
			align-items: center;
			gap: 12px;
			height: 48px;
			padding: 0 4px 0 0;
			background: var(--bg-overlay);
			border-bottom: 1px solid var(--border);
			flex-shrink: 0;
		}

		.hamburger {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 44px;
			color: var(--text-secondary);
			border-radius: var(--radius);
		}

		.hamburger:hover {
			background: var(--bg-surface);
			color: var(--text-primary);
		}

		.header-icon-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 40px;
			height: 44px;
			color: var(--text-secondary);
			border-radius: var(--radius);
			flex-shrink: 0;
		}

		.header-icon-btn:hover {
			background: var(--bg-surface);
			color: var(--text-primary);
		}

		.header-icon-btn.danger {
			color: var(--danger);
		}

		.header-icon-btn.confirm {
			color: var(--success);
		}

		.mobile-rename-input {
			flex: 1;
			height: 32px;
			background: var(--bg-surface);
			border: 1px solid var(--accent);
			border-radius: var(--radius);
			color: var(--text-primary);
			font-size: 14px;
			font-weight: 600;
			padding: 0 8px;
		}

		.app-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--text-primary);
			flex: 1;
		}
	}
</style>
```

---

## Task 6: Delete `src/routes/+page.svelte`

With `(app)/+page.svelte` and `(app)/[...path]/+page.svelte` in place, the old root page is no longer needed. Having both `src/routes/+page.svelte` and `src/routes/(app)/+page.svelte` would cause a route conflict (both map to `/`).

**Files:**
- Delete: `src/routes/+page.svelte`

- [ ] **Step 1: Delete the file**

```bash
git rm src/routes/+page.svelte
```

---

## Task 7: Run full validation and commit

- [ ] **Step 1: Run unit + integration tests and type check**

```bash
npm run validate
```

Expected: 107 tests pass, no type errors, no lint errors

- [ ] **Step 2: Run all E2E tests**

```bash
npx playwright test
```

Expected: All E2E tests pass, including the 4 new URL routing tests in `url-routing.spec.ts`

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(app\) src/lib/stores/ui.svelte.ts tests/e2e/url-routing.spec.ts
git commit -m "feat: URL-based folder routing persists selected folder on refresh"
```
