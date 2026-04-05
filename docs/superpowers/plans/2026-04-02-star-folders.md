# Star Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users star folders so they can filter the sidebar to show only starred folders, with stars persisted to `_stars.json` in GitHub.

**Architecture:** Starred folder paths are stored as a JSON array in `_stars.json` at the repo root (excluded from note sync by SyncEngine's `.md`-only filter). A `starredFolders` state + `starsSha` live in `notes.svelte.ts` alongside existing note state, following the same optimistic-update pattern. The sidebar gets a `starredFolders` prop and local `showStarredOnly` toggle; the folder panel header gets a star button.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, idb-keyval, @testing-library/svelte, Vitest, Playwright

---

## File Map

**Create:**
- `tests/integration/star-folder.test.ts` — store API integration tests
- `tests/integration/sidebar-star-filter.test.ts` — Sidebar component filter tests
- `tests/integration/folder-panel-star.test.ts` — FolderPanel star button tests
- `tests/e2e/star-folder.spec.ts` — end-to-end star workflow tests

**Modify:**
- `src/lib/cache.ts` — add `saveStarredFolders` / `getStarredFolders`
- `src/lib/stores/notes.svelte.ts` — add starred state + API + load in `loadNotes`
- `src/lib/components/Sidebar.svelte` — star indicators, filter button, filter logic
- `src/lib/components/FolderPanel.svelte` — star button in desktop header
- `src/routes/(app)/+layout.svelte` — pass `starredFolders` to `Sidebar`
- `src/routes/(app)/[...path]/+page.svelte` — star button in mobile header

**No changes needed:**
- `src/app.css` — `--warning: #f9e2af` already defined; use `var(--warning)` for star color
- `src/lib/types.ts` — no new exported types required

---

## Task 1: Extend NoteCache with starred-folders methods

**Files:**
- Modify: `src/lib/cache.ts`

- [ ] **Step 1: Add constants and methods to NoteCache**

In `src/lib/cache.ts`, add `STARRED_KEY` constant and two methods to the `NoteCache` class. The full updated file:

```ts
import { get, set, del, keys } from 'idb-keyval';
import type { Note, SyncQueueItem } from './types';

const NOTE_PREFIX = 'note:';
const SYNC_QUEUE_KEY = 'sync-queue';
const CONFIG_KEY = 'app-config';
const STARRED_KEY = 'starred-folders';

export class NoteCache {
	async saveNote(note: Note): Promise<void> {
		await set(`${NOTE_PREFIX}${note.path}`, note);
	}

	async getNote(path: string): Promise<Note | undefined> {
		return get<Note>(`${NOTE_PREFIX}${path}`);
	}

	async getAllNotes(): Promise<Note[]> {
		const allKeys = await keys();
		const noteKeys = allKeys.filter((k) => String(k).startsWith(NOTE_PREFIX));
		const notes: Note[] = [];
		for (const key of noteKeys) {
			const note = await get<Note>(key);
			if (note) notes.push(note);
		}
		return notes;
	}

	async deleteNote(path: string): Promise<void> {
		await del(`${NOTE_PREFIX}${path}`);
	}

	async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
		await set(SYNC_QUEUE_KEY, queue);
	}

	async getSyncQueue(): Promise<SyncQueueItem[]> {
		return (await get<SyncQueueItem[]>(SYNC_QUEUE_KEY)) ?? [];
	}

	async saveConfig(config: { token: string; repo: string }): Promise<void> {
		await set(CONFIG_KEY, config);
	}

	async getConfig(): Promise<{ token: string; repo: string } | undefined> {
		return get(CONFIG_KEY);
	}

	async saveStarredFolders(data: { paths: string[]; sha: string }): Promise<void> {
		await set(STARRED_KEY, data);
	}

	async getStarredFolders(): Promise<{ paths: string[]; sha: string } | undefined> {
		return get<{ paths: string[]; sha: string }>(STARRED_KEY);
	}
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat: add starred-folders methods to NoteCache"
```

---

## Task 2: Store API — write integration tests first, then implement

**Files:**
- Create: `tests/integration/star-folder.test.ts`
- Modify: `src/lib/stores/notes.svelte.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/star-folder.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse } from '../factories';
import { store as idbStore } from '../setup';

const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

const testCache = new NoteCache();

type StoreModule = typeof import('$lib/stores/notes.svelte');
let store: StoreModule;

beforeEach(async () => {
	mockFetch.mockReset();
	vi.resetModules();
	store = (await import('$lib/stores/notes.svelte')) as StoreModule;
	store.initStore('fake-token', 'testuser/mylife-notes');
	Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
});

afterEach(() => {
	Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
});

describe('toggleStarFolder', () => {
	it('adds a folder to the starred list immediately', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'star-sha' } }));

		await store.toggleStarFolder('inbox');

		expect(store.getStarredFolders()).toContain('inbox');
		expect(store.isStarredFolder('inbox')).toBe(true);
	});

	it('removes a folder when toggled a second time', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		await store.toggleStarFolder('inbox');
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));
		await store.toggleStarFolder('inbox');

		expect(store.getStarredFolders()).not.toContain('inbox');
		expect(store.isStarredFolder('inbox')).toBe(false);
	});

	it('calls createFile for _stars.json on first star (no existing SHA)', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

		await store.toggleStarFolder('work');

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/contents/_stars.json'),
			expect.objectContaining({ method: 'PUT' })
		);
		// No sha in body means create (not update)
		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.sha).toBeUndefined();
	});

	it('writes the correct JSON array to _stars.json', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));

		await store.toggleStarFolder('inbox');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		const content = atob(body.content);
		expect(JSON.parse(content)).toEqual(['inbox']);
	});

	it('calls updateFile (includes sha in body) after first star sets SHA', async () => {
		// First toggle — creates file, returns SHA
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'first-sha' } }));
		await store.toggleStarFolder('inbox');
		mockFetch.mockReset();

		// Second toggle on a different folder — should update with the known SHA
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'second-sha' } }));
		await store.toggleStarFolder('work');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.sha).toBe('first-sha');
	});

	it('patches starsSha after GitHub responds', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'first-sha' } }));
		await store.toggleStarFolder('inbox');
		mockFetch.mockReset();

		// Second call should use updated SHA
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'second-sha' } }));
		await store.toggleStarFolder('work');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.sha).toBe('first-sha');
	});

	it('saves starred folders to IndexedDB cache', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));

		await store.toggleStarFolder('inbox');

		const cached = idbStore.get('starred-folders') as { paths: string[]; sha: string };
		expect(cached.paths).toContain('inbox');
	});

	it('queues a create op when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.toggleStarFolder('inbox');

		expect(mockFetch).not.toHaveBeenCalled();
		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === '_stars.json' && q.action === 'create')).toBe(true);
	});

	it('queues an op when the API call fails', async () => {
		mockFetch.mockRejectedValueOnce(new Error('network error'));

		await store.toggleStarFolder('inbox');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === '_stars.json')).toBe(true);
	});
});

describe('loadNotes — star bootstrap', () => {
	it('loads starred folders from cache when offline', async () => {
		idbStore.set('starred-folders', { paths: ['cached-inbox'], sha: 'sha-from-cache' });
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.loadNotes();

		expect(store.isStarredFolder('cached-inbox')).toBe(true);
	});
});
```

- [ ] **Step 2: Run the tests to confirm they all fail**

```bash
npm test -- tests/integration/star-folder.test.ts
```

Expected: all tests FAIL with errors like "store.toggleStarFolder is not a function".

- [ ] **Step 3: Implement the store changes**

Replace the contents of `src/lib/stores/notes.svelte.ts` with the updated version below. Key changes: two new state vars (`starredFolders`, `starsSha`), updated `loadNotes`, three new exports (`getStarredFolders`, `isStarredFolder`, `toggleStarFolder`):

```ts
import type { Note, Folder, SyncQueueItem } from '$lib/types';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { SyncEngine } from '$lib/sync';

// --- Pure utility functions (exported for testing) ---

export function createSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

export function buildFolderTree(paths: string[]): Folder[] {
	const folderSet = new Map<string, Folder>();

	for (const path of paths) {
		const parts = path.split('/');
		for (let i = 0; i < parts.length - 1; i++) {
			const folderPath = parts.slice(0, i + 1).join('/');
			if (!folderSet.has(folderPath)) {
				folderSet.set(folderPath, {
					path: folderPath,
					name: parts[i],
					children: []
				});
			}
		}
	}

	const roots: Folder[] = [];
	for (const folder of folderSet.values()) {
		const parentPath = folder.path.split('/').slice(0, -1).join('/');
		const parent = folderSet.get(parentPath);
		if (parent) {
			if (!parent.children.find((c) => c.path === folder.path)) {
				parent.children.push(folder);
			}
		} else {
			roots.push(folder);
		}
	}

	return roots;
}

// --- Helpers ---

async function queueOp(item: SyncQueueItem) {
	const queue = await cache.getSyncQueue();
	queue.push(item);
	await cache.saveSyncQueue(queue);
}

// --- Reactive store ---

let notes = $state<Note[]>([]);
let loading = $state(false);
let initialized = $state(false);
let starredFolders = $state<string[]>([]);
let starsSha = $state<string>('');

let github: GitHubClient | null = null;
const cache = new NoteCache();
let sync: SyncEngine | null = null;

export function initStore(token: string, repo: string) {
	github = new GitHubClient(token, repo);
	sync = new SyncEngine(github, cache);
}

export function getNotes() {
	return notes;
}

export function isLoading() {
	return loading;
}

export function isInitialized() {
	return initialized;
}

export function getStarredFolders(): string[] {
	return starredFolders;
}

export function isStarredFolder(path: string): boolean {
	return starredFolders.includes(path);
}

export async function toggleStarFolder(path: string): Promise<void> {
	const already = starredFolders.includes(path);
	starredFolders = already
		? starredFolders.filter((p) => p !== path)
		: [...starredFolders, path];

	await cache.saveStarredFolders({ paths: starredFolders, sha: starsSha });

	const json = JSON.stringify(starredFolders);
	const now = new Date().toISOString();

	if (navigator.onLine && github) {
		try {
			const sha = starsSha
				? await github.updateFile('_stars.json', json, starsSha)
				: await github.createFile('_stars.json', json);
			starsSha = sha;
			await cache.saveStarredFolders({ paths: starredFolders, sha: starsSha });
		} catch {
			await queueOp({
				action: starsSha ? 'update' : 'create',
				path: '_stars.json',
				content: json,
				sha: starsSha ? starsSha : undefined,
				queuedAt: now
			});
		}
	} else {
		await queueOp({
			action: starsSha ? 'update' : 'create',
			path: '_stars.json',
			content: json,
			sha: starsSha ? starsSha : undefined,
			queuedAt: now
		});
	}
}

export async function loadNotes() {
	loading = true;
	try {
		// Load starred folders from cache immediately (before network)
		const cachedStars = await cache.getStarredFolders();
		if (cachedStars) {
			starredFolders = cachedStars.paths;
			starsSha = cachedStars.sha;
		}

		const cached = await cache.getAllNotes();
		if (cached.length > 0) {
			notes = cached;
			initialized = true;
		}

		if (navigator.onLine && sync && github) {
			try {
				await sync.pushOfflineQueue();
				const synced = await sync.fullSync();
				notes = synced;
			} catch {
				// GitHub sync failed — keep showing cached notes
			}
			try {
				const starsFile = await github.getFileContent('_stars.json');
				starredFolders = JSON.parse(starsFile.content) as string[];
				starsSha = starsFile.sha;
				await cache.saveStarredFolders({ paths: starredFolders, sha: starsSha });
			} catch {
				// _stars.json doesn't exist yet — keep cached/empty values
			}
		}

		initialized = true;
	} finally {
		loading = false;
	}
}

export async function createNote(
	folder: string,
	title: string,
	type: 'text' | 'todo'
): Promise<Note> {
	const slug = createSlug(title) || 'untitled';
	const path = `${folder}/${slug}.md`;
	const content = type === 'todo' ? `${title}\n\n- [ ] ` : title;
	const now = new Date().toISOString();

	const note: Note = { path, title, content, type, pinned: false, updatedAt: now, sha: '' };

	// Optimistic: show immediately
	notes = [...notes, note];
	await cache.saveNote(note);

	if (navigator.onLine && github) {
		try {
			const sha = await github.createFile(path, content);
			const updated = { ...note, sha };
			notes = notes.map((n) => (n.path === path ? updated : n));
			await cache.saveNote(updated);
			return updated;
		} catch {
			await queueOp({ action: 'create', path, content, queuedAt: now });
		}
	} else {
		await queueOp({ action: 'create', path, content, queuedAt: now });
	}

	return note;
}

export async function updateNote(path: string, content: string) {
	const existing = notes.find((n) => n.path === path);
	if (!existing) return;

	const now = new Date().toISOString();
	const updated: Note = {
		...existing,
		content,
		title: content.split('\n')[0]?.trim().replace(/^#\s*/, '') || existing.title,
		type: content.includes('- [ ]') || content.includes('- [x]') ? 'todo' : 'text',
		updatedAt: now
	};

	// Optimistic: update immediately, keep existing sha until GitHub confirms
	notes = notes.map((n) => (n.path === path ? updated : n));
	await cache.saveNote(updated);

	if (navigator.onLine && github) {
		try {
			const sha = await github.updateFile(path, content, existing.sha);
			const withSha = { ...updated, sha };
			notes = notes.map((n) => (n.path === path ? withSha : n));
			await cache.saveNote(withSha);
		} catch {
			await queueOp({ action: 'update', path, content, sha: existing.sha, queuedAt: now });
		}
	} else {
		await queueOp({ action: 'update', path, content, sha: existing.sha, queuedAt: now });
	}
}

export async function deleteNote(path: string) {
	const note = notes.find((n) => n.path === path);
	if (!note) return;

	const now = new Date().toISOString();

	// Optimistic: remove immediately
	notes = notes.filter((n) => n.path !== path);
	await cache.deleteNote(path);

	if (navigator.onLine && github) {
		try {
			if (note.sha) await github.deleteFile(path, note.sha);
		} catch {
			if (note.sha) await queueOp({ action: 'delete', path, sha: note.sha, queuedAt: now });
		}
	} else {
		if (note.sha) await queueOp({ action: 'delete', path, sha: note.sha, queuedAt: now });
	}
}

export async function togglePin(path: string) {
	const note = notes.find((n) => n.path === path);
	if (!note) return;
	const updated = { ...note, pinned: !note.pinned };
	notes = notes.map((n) => (n.path === path ? updated : n));
	await cache.saveNote(updated);
}

export function getNotesInFolder(folder: string): Note[] {
	return notes.filter((n) => {
		const dir = n.path.substring(0, n.path.lastIndexOf('/'));
		return dir === folder && !n.path.endsWith('.gitkeep');
	});
}

export function getPinnedNotes(): Note[] {
	return notes.filter((n) => n.pinned);
}

export function getFolderNote(folder: string): Note | null {
	return notes.find((n) => n.path === `${folder}/index.md`) ?? null;
}

export function getFolderTree(): Folder[] {
	return buildFolderTree(notes.map((n) => n.path));
}

export async function createFolder(name: string): Promise<void> {
	const path = `${name}/index.md`;
	const now = new Date().toISOString();
	const note: Note = {
		path,
		title: 'index.md',
		content: '',
		type: 'text',
		pinned: false,
		updatedAt: now,
		sha: ''
	};

	// Optimistic: add to store and cache immediately
	if (!notes.find((n) => n.path === path)) {
		notes = [...notes, note];
		await cache.saveNote(note);
	}

	if (navigator.onLine && github) {
		let sha = '';
		try {
			sha = await github.createFile(path, '');
		} catch {
			try {
				const existing = await github.getFileContent(path);
				sha = existing.sha;
			} catch {
				await queueOp({ action: 'create', path, content: '', queuedAt: now });
			}
		}
		if (sha) {
			const updated = { ...note, sha };
			notes = notes.map((n) => (n.path === path ? updated : n));
			await cache.saveNote(updated);
		}
	} else {
		await queueOp({ action: 'create', path, content: '', queuedAt: now });
	}
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
	const toMove = notes.filter((n) => n.path.startsWith(`${oldName}/`));
	const now = new Date().toISOString();

	// Optimistic: rename all notes in store and cache immediately
	const renamed: Note[] = toMove.map((n) => ({
		...n,
		path: `${newName}/${n.path.slice(oldName.length + 1)}`,
		updatedAt: now
	}));

	for (let i = 0; i < toMove.length; i++) {
		await cache.deleteNote(toMove[i].path);
		await cache.saveNote(renamed[i]);
	}
	notes = [...notes.filter((n) => !n.path.startsWith(`${oldName}/`)), ...renamed];

	// Sync to GitHub — each file is independent
	for (let i = 0; i < toMove.length; i++) {
		const original = toMove[i];
		const newPath = renamed[i].path;

		if (navigator.onLine && github) {
			try {
				const sha = await github.createFile(newPath, original.content);
				if (original.sha) await github.deleteFile(original.path, original.sha);
				const updated = { ...renamed[i], sha };
				notes = notes.map((n) => (n.path === newPath ? updated : n));
				await cache.saveNote(updated);
			} catch {
				await queueOp({
					action: 'create',
					path: newPath,
					content: original.content,
					queuedAt: now
				});
				if (original.sha)
					await queueOp({
						action: 'delete',
						path: original.path,
						sha: original.sha,
						queuedAt: now
					});
			}
		} else {
			await queueOp({ action: 'create', path: newPath, content: original.content, queuedAt: now });
			if (original.sha)
				await queueOp({ action: 'delete', path: original.path, sha: original.sha, queuedAt: now });
		}
	}
}

export async function deleteFolder(name: string): Promise<void> {
	const toDelete = notes.filter((n) => n.path.startsWith(`${name}/`));
	const now = new Date().toISOString();

	// Optimistic: remove all notes in folder from store and cache immediately
	for (const note of toDelete) {
		await cache.deleteNote(note.path);
	}
	notes = notes.filter((n) => !n.path.startsWith(`${name}/`));

	// Sync to GitHub — each file is independent
	for (const note of toDelete) {
		if (navigator.onLine && github) {
			try {
				if (note.sha) await github.deleteFile(note.path, note.sha);
			} catch {
				if (note.sha)
					await queueOp({ action: 'delete', path: note.path, sha: note.sha, queuedAt: now });
			}
		} else {
			if (note.sha)
				await queueOp({ action: 'delete', path: note.path, sha: note.sha, queuedAt: now });
		}
	}
}
```

- [ ] **Step 4: Run the tests to confirm they all pass**

```bash
npm test -- tests/integration/star-folder.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all 128+ tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/notes.svelte.ts tests/integration/star-folder.test.ts
git commit -m "feat: add starred folders store API with GitHub persistence"
```

---

## Task 3: Sidebar — star indicators, filter button, filter logic

**Files:**
- Create: `tests/integration/sidebar-star-filter.test.ts`
- Modify: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1: Write the failing component tests**

Create `tests/integration/sidebar-star-filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Sidebar from '$lib/components/Sidebar.svelte';
import { createTestFolder } from '../factories';

const work = createTestFolder({
	path: 'work',
	name: 'work',
	children: [
		createTestFolder({ path: 'work/notes', name: 'notes' }),
		createTestFolder({ path: 'work/archive', name: 'archive' })
	]
});

const personal = createTestFolder({
	path: 'personal',
	name: 'personal',
	children: [createTestFolder({ path: 'personal/journal', name: 'journal' })]
});

const folders = [work, personal];

describe('Sidebar star filter', () => {
	it('shows a "Show starred folders" button in sidebar actions', () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: [] } });
		expect(screen.getByRole('button', { name: 'Show starred folders' })).toBeInTheDocument();
	});

	it('filter button toggles label to "Show all folders" when active', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: [] } });
		await fireEvent.click(screen.getByRole('button', { name: 'Show starred folders' }));
		expect(screen.getByRole('button', { name: 'Show all folders' })).toBeInTheDocument();
	});

	it('shows all folders when filter is inactive', () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: ['work'] } });
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^personal$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^notes$/ })).toBeInTheDocument();
	});

	it('shows only starred folder when filter is active', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: ['work'] } });
		await fireEvent.click(screen.getByRole('button', { name: 'Show starred folders' }));

		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^notes$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^archive$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('shows parent folder and starred subfolder when subfolder is starred', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: ['work/notes'] } });
		await fireEvent.click(screen.getByRole('button', { name: 'Show starred folders' }));

		// Parent shown as container
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		// Starred subfolder visible
		expect(screen.getByRole('button', { name: /^notes$/ })).toBeInTheDocument();
		// Non-starred subfolder hidden
		expect(screen.queryByRole('button', { name: /^archive$/ })).not.toBeInTheDocument();
		// Unrelated folder hidden
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('shows empty list when filter active and no starred folders', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: [] } });
		await fireEvent.click(screen.getByRole('button', { name: 'Show starred folders' }));

		expect(screen.queryByRole('button', { name: /^work$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('shows star indicator only on starred folders', () => {
		render(Sidebar, { props: { folders, selectedFolder: null, starredFolders: ['work'] } });

		// work has a star indicator, personal does not
		const workBtn = screen.getByRole('button', { name: /^work$/ }).closest('li')!;
		const personalBtn = screen.getByRole('button', { name: /^personal$/ }).closest('li')!;
		expect(workBtn.querySelector('.folder-star')).toBeInTheDocument();
		expect(personalBtn.querySelector('.folder-star')).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run to confirm all tests fail**

```bash
npm test -- tests/integration/sidebar-star-filter.test.ts
```

Expected: all tests FAIL.

- [ ] **Step 3: Implement Sidebar changes**

Replace `src/lib/components/Sidebar.svelte` with:

```svelte
<script lang="ts">
	import type { Folder } from '$lib/types';

	interface Props {
		folders: Folder[];
		selectedFolder: string | null;
		isOpen?: boolean;
		theme?: 'dark' | 'light';
		starredFolders?: string[];
		onselectfolder?: (path: string) => void;
		oncreatefolder?: (name: string) => void;
		onclose?: () => void;
		ontoggletheme?: () => void;
	}

	let {
		folders,
		selectedFolder,
		isOpen = false,
		theme = 'dark',
		starredFolders = [],
		onselectfolder,
		oncreatefolder,
		onclose,
		ontoggletheme
	}: Props = $props();

	let adding = $state(false);
	let newFolderName = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);
	let searchQuery = $state('');
	let showStarredOnly = $state(false);

	let filteredFolders = $derived.by(() => {
		// Step 1: apply star filter
		let base = folders;
		if (showStarredOnly) {
			const starFiltered: Folder[] = [];
			for (const folder of folders) {
				const folderStarred = starredFolders.includes(folder.path);
				const starredChildren = folder.children.filter((c) =>
					starredFolders.includes(c.path)
				);
				if (folderStarred || starredChildren.length > 0) {
					starFiltered.push({ ...folder, children: starredChildren });
				}
			}
			base = starFiltered;
		}

		// Step 2: apply search filter
		if (!searchQuery.trim()) return base;
		const q = searchQuery.trim().toLowerCase();
		const result: Folder[] = [];
		for (const folder of base) {
			if (folder.name.toLowerCase().includes(q)) {
				result.push({ ...folder, children: [] });
			} else {
				const matchingChildren = folder.children.filter((c) =>
					c.name.toLowerCase().includes(q)
				);
				if (matchingChildren.length > 0) {
					result.push({ ...folder, children: matchingChildren });
				}
			}
		}
		return result;
	});

	function startAdding() {
		adding = true;
		newFolderName = '';
	}

	$effect(() => {
		if (adding && inputEl) inputEl.focus();
	});

	function confirmAdd() {
		const name = newFolderName.trim();
		if (name) oncreatefolder?.(name);
		adding = false;
		newFolderName = '';
	}

	function cancelAdd() {
		adding = false;
		newFolderName = '';
	}

	$effect(() => {
		if (!isOpen) searchQuery = '';
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmAdd();
		if (e.key === 'Escape') cancelAdd();
	}
</script>

<nav class="sidebar" class:open={isOpen}>
	<div class="sidebar-header">
		<button class="close-btn" onclick={() => onclose?.()} aria-label="Close folders">
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>

	<div class="search-wrap">
		<input
			class="search-input"
			type="search"
			placeholder="Search folders…"
			bind:value={searchQuery}
			autocomplete="off"
			spellcheck={false}
		/>
	</div>

	<ul class="folder-list">
		{#each filteredFolders as folder (folder.path)}
			<li>
				<button
					class="folder-item"
					data-folder={folder.path}
					data-active={selectedFolder === folder.path}
					onclick={() => onselectfolder?.(folder.path)}
				>
					<span class="folder-icon">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
							<path
								d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
							/>
						</svg>
					</span>
					<span class="folder-name">{folder.name}</span>
					{#if starredFolders.includes(folder.path)}
						<span class="folder-star" aria-hidden="true">
							<svg
								width="11"
								height="11"
								viewBox="0 0 24 24"
								fill="var(--warning)"
								stroke="none"
							>
								<polygon
									points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
								/>
							</svg>
						</span>
					{/if}
				</button>
			</li>
			{#each folder.children as child (child.path)}
				<li>
					<button
						class="folder-item subfolder-item"
						data-folder={child.path}
						data-active={selectedFolder === child.path}
						onclick={() => onselectfolder?.(child.path)}
					>
						<span class="folder-icon">
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
							</svg>
						</span>
						<span class="folder-name">{child.name}</span>
						{#if starredFolders.includes(child.path)}
							<span class="folder-star" aria-hidden="true">
								<svg
									width="11"
									height="11"
									viewBox="0 0 24 24"
									fill="var(--warning)"
									stroke="none"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
							</span>
						{/if}
					</button>
				</li>
			{/each}
		{/each}

		{#if adding}
			<li class="folder-add-row">
				<span class="folder-icon">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
					</svg>
				</span>
				<input
					bind:this={inputEl}
					class="folder-name-input"
					placeholder="folder name"
					bind:value={newFolderName}
					onkeydown={handleKeyDown}
					onblur={cancelAdd}
				/>
			</li>
		{/if}
	</ul>

	<div class="sidebar-actions">
		<button class="action-btn" onclick={startAdding} aria-label="New folder" title="New folder">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--accent)"
				stroke-width="2"
			>
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				<line x1="12" y1="11" x2="12" y2="17" />
				<line x1="9" y1="14" x2="15" y2="14" />
			</svg>
		</button>
		<button
			class="action-btn"
			onclick={() => (showStarredOnly = !showStarredOnly)}
			aria-label={showStarredOnly ? 'Show all folders' : 'Show starred folders'}
			title={showStarredOnly ? 'Show all folders' : 'Show starred folders'}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill={showStarredOnly ? 'var(--warning)' : 'none'}
				stroke={showStarredOnly ? 'none' : 'currentColor'}
				stroke-width="2"
			>
				<polygon
					points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
				/>
			</svg>
		</button>
		<button
			class="theme-btn"
			onclick={() => ontoggletheme?.()}
			aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if theme === 'dark'}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#f9e2af"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			{:else}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
	</div>
</nav>

<style>
	.sidebar {
		width: 220px;
		min-width: 220px;
		height: 100%;
		background: var(--bg-overlay);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 5px 0 0;
	}

	.folder-list {
		list-style: none;
		flex: 1;
		overflow-y: auto;
	}

	.folder-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 16px;
		font-size: 13px;
		color: var(--text-secondary);
		border-radius: 0;
		text-align: left;
		transition: background 0.1s;
	}

	.folder-item:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.folder-item[data-active='true'] {
		background: var(--bg-surface);
		color: var(--text-primary);
		border-right: 2px solid var(--accent);
	}

	.subfolder-item {
		padding-left: 40px;
		font-size: 12px;
	}

	.folder-add-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
	}

	.folder-name-input {
		flex: 1;
		font-size: 13px;
		padding: 4px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-surface);
	}

	.folder-icon {
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.folder-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.folder-star {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.sidebar-actions {
		display: flex;
		border-top: 1px solid var(--border);
		justify-content: space-around;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		min-width: 36px;
		padding: 6px;
		color: var(--text-muted);
		border-radius: var(--radius);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.action-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		min-width: 36px;
		padding: 6px;
		color: var(--text-muted);
		border-radius: var(--radius);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.theme-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.sidebar-header {
		display: none;
	}

	.search-wrap {
		padding: 0px 8px 6px 8px;
	}

	.search-input {
		width: 100%;
		box-sizing: border-box;
		padding: 6px 12px;
		font-size: 13px;
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.search-input:focus {
		border-color: var(--accent);
	}

	.close-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		color: var(--text-muted);
		border-radius: var(--radius);
	}

	.close-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	@media (max-width: 768px) {
		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100%;
			width: 280px;
			z-index: 100;
			transform: translateX(-100%);
			transition: transform 200ms ease;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-header {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			padding: 0 8px 4px 16px;
		}

		.close-btn {
			display: flex;
		}

		.folder-item {
			min-height: 32px;
			padding: 4px 16px;
		}

		.subfolder-item {
			padding-left: 40px;
		}

		.action-btn {
			min-height: 44px;
			width: 44px;
			min-width: 44px;
		}

		.theme-btn {
			min-height: 44px;
			width: 44px;
			min-width: 44px;
		}
	}
</style>
```

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
npm test -- tests/integration/sidebar-star-filter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Sidebar.svelte tests/integration/sidebar-star-filter.test.ts
git commit -m "feat: add star filter and indicators to Sidebar"
```

---

## Task 4: FolderPanel star button + layout wiring

**Files:**
- Create: `tests/integration/folder-panel-star.test.ts`
- Modify: `src/lib/components/FolderPanel.svelte`
- Modify: `src/routes/(app)/+layout.svelte`
- Modify: `src/routes/(app)/[...path]/+page.svelte`

- [ ] **Step 1: Write the failing component test**

Create `tests/integration/folder-panel-star.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FolderPanel from '$lib/components/FolderPanel.svelte';

const baseProps = {
	folder: 'inbox',
	note: null,
	renaming: false,
	renameName: '',
	confirming: false
};

describe('FolderPanel star button', () => {
	it('renders a "Star folder" button when not starred', () => {
		render(FolderPanel, { props: { ...baseProps, starred: false, ontogglestar: vi.fn() } });
		expect(screen.getByRole('button', { name: 'Star folder' })).toBeInTheDocument();
	});

	it('renders an "Unstar folder" button when starred', () => {
		render(FolderPanel, { props: { ...baseProps, starred: true, ontogglestar: vi.fn() } });
		expect(screen.getByRole('button', { name: 'Unstar folder' })).toBeInTheDocument();
	});

	it('calls ontogglestar when star button is clicked', async () => {
		const ontogglestar = vi.fn();
		render(FolderPanel, { props: { ...baseProps, starred: false, ontogglestar } });
		await fireEvent.click(screen.getByRole('button', { name: 'Star folder' }));
		expect(ontogglestar).toHaveBeenCalledOnce();
	});

	it('star button is not shown while renaming', () => {
		render(FolderPanel, {
			props: { ...baseProps, starred: false, ontogglestar: vi.fn(), renaming: true, renameName: 'inbox' }
		});
		expect(screen.queryByRole('button', { name: 'Star folder' })).not.toBeInTheDocument();
	});

	it('star button is not shown while confirming delete', () => {
		render(FolderPanel, {
			props: { ...baseProps, starred: false, ontogglestar: vi.fn(), confirming: true }
		});
		expect(screen.queryByRole('button', { name: 'Star folder' })).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run to confirm the tests fail**

```bash
npm test -- tests/integration/folder-panel-star.test.ts
```

Expected: tests FAIL with "Unable to find an accessible element with role button and name 'Star folder'".

- [ ] **Step 3: Add star props and button to FolderPanel.svelte**

In `src/lib/components/FolderPanel.svelte`, update the `interface Props` and destructuring to add `starred` and `ontogglestar`, then add the star button in the actions section.

Replace the `<script lang="ts">` block's interface and destructuring:

```ts
interface Props {
	folder: string;
	note: Note | null;
	renaming: boolean;
	renameName: string;
	confirming: boolean;
	addingSubfolder?: boolean;
	subfolderName?: string;
	starred?: boolean;
	onstartrename?: () => void;
	onstartdelete?: () => void;
	onstartaddsubfolder?: () => void;
	onrenameinput?: (value: string) => void;
	onconfirmrename?: () => void;
	oncancelrename?: () => void;
	onconfirmdelete?: () => void;
	oncanceldelete?: () => void;
	onsubfolderinput?: (value: string) => void;
	onconfirmsubfolder?: () => void;
	oncancelsubfolder?: () => void;
	onsave?: (content: string) => void;
	ontogglestar?: () => void;
}

let {
	folder,
	note,
	renaming,
	renameName,
	confirming,
	addingSubfolder = false,
	subfolderName = '',
	starred = false,
	onstartrename,
	onstartdelete,
	onstartaddsubfolder,
	onrenameinput,
	onconfirmrename,
	oncancelrename,
	onconfirmdelete,
	oncanceldelete,
	onsubfolderinput,
	onconfirmsubfolder,
	oncancelsubfolder,
	onsave,
	ontogglestar
}: Props = $props();
```

In the template, find the `{:else if !confirming && !addingSubfolder}` block. Add the star button between the subfolder button and the delete button:

```svelte
{:else if !confirming && !addingSubfolder}
	<button
		class="action-btn icon-btn"
		onclick={onstartrename}
		aria-label="Rename"
		title="Rename"
	>
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
	{#if isTopLevel}
		<button
			class="action-btn icon-btn"
			onclick={onstartaddsubfolder}
			aria-label="Add sub-folder"
			title="Add sub-folder"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--accent)"
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
	<button
		class="action-btn icon-btn"
		onclick={ontogglestar}
		aria-label={starred ? 'Unstar folder' : 'Star folder'}
		title={starred ? 'Unstar folder' : 'Star folder'}
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill={starred ? 'var(--warning)' : 'none'}
			stroke={starred ? 'none' : 'currentColor'}
			stroke-width="2"
		>
			<polygon
				points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
			/>
		</svg>
	</button>
	<button
		class="action-btn icon-btn danger"
		onclick={onstartdelete}
		aria-label="Delete"
		title="Delete"
	>
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
```

- [ ] **Step 4: Wire FolderPanel in `[...path]/+page.svelte`**

In `src/routes/(app)/[...path]/+page.svelte`, import `toggleStarFolder` and `isStarredFolder`, derive `starred`, add star button to the mobile header, and pass the new props to `FolderPanel`.

Replace the import block at the top of `<script lang="ts">`:

```ts
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
	createFolder,
	isInitialized,
	toggleStarFolder,
	isStarredFolder
} from '$lib/stores/notes.svelte';
import { setSidebarOpen } from '$lib/stores/ui.svelte';
```

Add a derived for `starred` after `let folderNote = $derived(...)`:

```ts
let starred = $derived(isStarredFolder(selectedFolder));
```

In the mobile header template, add the star button inside the `{#if !confirming && !addingSubfolder}` block, between the add-subfolder button and the delete button:

```svelte
{#if !confirming && !addingSubfolder}
	<button class="header-icon-btn" onclick={startRename} aria-label="Rename">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
			<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
		</svg>
	</button>
	{#if selectedIsTopLevel}
		<button class="header-icon-btn" onclick={startAddSubfolder} aria-label="Add sub-folder">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				<line x1="12" y1="11" x2="12" y2="17" />
				<line x1="9" y1="14" x2="15" y2="14" />
			</svg>
		</button>
	{/if}
	<button
		class="header-icon-btn"
		onclick={() => toggleStarFolder(selectedFolder)}
		aria-label={starred ? 'Unstar folder' : 'Star folder'}
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill={starred ? 'var(--warning)' : 'none'}
			stroke={starred ? 'none' : 'currentColor'}
			stroke-width="2"
		>
			<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
		</svg>
	</button>
	<button class="header-icon-btn danger" onclick={startDelete} aria-label="Delete">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
			<path d="M10 11v6" />
			<path d="M14 11v6" />
			<path d="M9 6V4h6v2" />
		</svg>
	</button>
{/if}
```

Pass the new props to `<FolderPanel>`:

```svelte
<FolderPanel
	folder={selectedFolder}
	note={folderNote}
	{renaming}
	{renameName}
	{confirming}
	{addingSubfolder}
	{subfolderName}
	{starred}
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
	ontogglestar={() => toggleStarFolder(selectedFolder)}
/>
```

- [ ] **Step 5: Wire `+layout.svelte` to pass starredFolders to Sidebar**

In `src/routes/(app)/+layout.svelte`, import `getStarredFolders` and derive `starredFolders`:

```svelte
<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { getFolderTree, createFolder, getStarredFolders } from '$lib/stores/notes.svelte';
	import { getSidebarOpen, setSidebarOpen, getTheme, toggleTheme } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	let folders = $derived(getFolderTree());
	let selectedFolder = $derived((page.params as { path?: string }).path ?? null);
	let sidebarOpen = $derived(getSidebarOpen());
	let theme = $derived(getTheme());
	let starredFolders = $derived(getStarredFolders());

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
		{theme}
		{starredFolders}
		isOpen={sidebarOpen}
		onselectfolder={handleSelectFolder}
		oncreatefolder={handleCreateFolder}
		onclose={() => setSidebarOpen(false)}
		ontoggletheme={toggleTheme}
	/>

	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="drawer-backdrop" onclick={() => setSidebarOpen(false)}></div>
	{/if}

	<main class="main">
		{@render children()}
	</main>
</div>
```

(Keep the existing `<style>` block unchanged.)

- [ ] **Step 6: Run the component tests to confirm they pass**

```bash
npm test -- tests/integration/folder-panel-star.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Run validate to confirm everything passes**

```bash
npm run validate
```

Expected: 0 type errors, 0 lint errors, all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/FolderPanel.svelte src/routes/(app)/+layout.svelte src/routes/(app)/[...path]/+page.svelte tests/integration/folder-panel-star.test.ts
git commit -m "feat: add star button to folder panel and wire up layout"
```

---

## Task 5: E2E tests

**Files:**
- Create: `tests/e2e/star-folder.spec.ts`

- [ ] **Step 1: Start the dev server** (in a separate terminal)

```bash
npm run dev
```

- [ ] **Step 2: Write the E2E tests**

Create `tests/e2e/star-folder.spec.ts`:

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
			const filePath = new URL(url).pathname.split('/contents/')[1];
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

test.describe('Star folders', () => {
	test('star button appears in folder panel header', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);
		await page.locator('[data-folder="inbox"]').click();
		await expect(page.getByRole('button', { name: 'Star folder' })).toBeVisible();
	});

	test('star button fills when clicked and sidebar shows indicator', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);
		await page.locator('[data-folder="inbox"]').click();

		await page.getByRole('button', { name: 'Star folder' }).click();

		// Button label changes to Unstar
		await expect(page.getByRole('button', { name: 'Unstar folder' })).toBeVisible();

		// Star indicator appears on folder in sidebar
		const folderItem = page.locator('[data-folder="inbox"]').locator('..');
		await expect(folderItem.locator('.folder-star')).toBeVisible();
	});

	test('star filter button shows only starred folders', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/index.md', content: '', sha: 'sha-2' }
		]);

		// Star inbox
		await page.locator('[data-folder="inbox"]').click();
		await page.getByRole('button', { name: 'Star folder' }).click();

		// Activate star filter
		await page.getByRole('button', { name: 'Show starred folders' }).click();

		// Only inbox is visible
		await expect(page.locator('[data-folder="inbox"]')).toBeVisible();
		await expect(page.locator('[data-folder="work"]')).not.toBeVisible();
	});

	test('disabling star filter shows all folders again', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/index.md', content: '', sha: 'sha-2' }
		]);

		await page.locator('[data-folder="inbox"]').click();
		await page.getByRole('button', { name: 'Star folder' }).click();

		await page.getByRole('button', { name: 'Show starred folders' }).click();
		await page.getByRole('button', { name: 'Show all folders' }).click();

		await expect(page.locator('[data-folder="inbox"]')).toBeVisible();
		await expect(page.locator('[data-folder="work"]')).toBeVisible();
	});

	test('starring a subfolder shows parent and subfolder when filter is active', async ({
		page
	}) => {
		await setupApp(page, [
			{ path: 'work/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/projects/index.md', content: '', sha: 'sha-2' },
			{ path: 'inbox/index.md', content: '', sha: 'sha-3' }
		]);

		// Navigate to the subfolder and star it
		await page.locator('[data-folder="work/projects"]').click();
		await page.getByRole('button', { name: 'Star folder' }).click();

		// Activate star filter
		await page.getByRole('button', { name: 'Show starred folders' }).click();

		// Parent (work) and subfolder (projects) are visible
		await expect(page.locator('[data-folder="work"]')).toBeVisible();
		await expect(page.locator('[data-folder="work/projects"]')).toBeVisible();

		// Unrelated folder (inbox) is hidden
		await expect(page.locator('[data-folder="inbox"]')).not.toBeVisible();
	});
});
```

- [ ] **Step 3: Run the E2E tests**

```bash
npm run test:e2e -- tests/e2e/star-folder.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Run full validate**

```bash
npm run validate
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/star-folder.spec.ts
git commit -m "test: add E2E tests for star folders feature"
```
