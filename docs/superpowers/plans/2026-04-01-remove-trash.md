# Remove Trash Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the soft-delete (trash) mechanism with permanent deletion throughout the store, UI, and tests.

**Architecture:** Three changes: (1) rewrite `deleteNote` and `deleteFolder` in the store to call `github.deleteFile` instead of creating copies in `.trash/`, (2) remove the trash button from Sidebar and update FolderPanel confirmation copy, (3) update all tests to reflect permanent deletion.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Vitest + @testing-library/svelte, Playwright E2E

---

### Task 1: Rewrite `deleteNote` with TDD

**Files:**
- Modify: `tests/integration/note-crud.test.ts:146-251`
- Modify: `src/lib/stores/notes.svelte.ts:174-202`

- [ ] **Step 1: Replace the `deleteNote` describe block in the test file**

Replace lines 146–211 of `tests/integration/note-crud.test.ts` (the entire `deleteNote` describe block and the `getFolderTree` `.trash` exclusion test at lines 239–252) with:

```ts
// ── deleteNote ────────────────────────────────────────────────────────────────

describe('deleteNote', () => {
	it('removes note from store and cache immediately', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'To Delete', 'text');
		mockFetch.mockReset();
		mockFetch.mockResolvedValueOnce(githubResponse({}));

		await store.deleteNote(note.path);

		const notes = store.getNotes();
		expect(notes.some((n) => n.path === note.path)).toBe(false);
		expect(notes.some((n) => n.path.startsWith('.trash/'))).toBe(false);
	});

	it('calls deleteFile with the correct path and sha', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-del' } }));
		const note = await store.createNote('inbox', 'Del SHA Test', 'text');
		mockFetch.mockReset();
		mockFetch.mockResolvedValueOnce(githubResponse({}));

		await store.deleteNote(note.path);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('inbox');
		expect((opts.method as string).toUpperCase()).toBe('DELETE');
	});

	it('queues delete op when API fails', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Fail Delete', 'text');

		mockFetch.mockRejectedValueOnce(new Error('network error'));

		await store.deleteNote(note.path);

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'delete' && q.path === note.path)).toBe(true);
	});

	it('queues delete op and skips API when offline', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Offline Delete', 'text');
		mockFetch.mockReset();

		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.deleteNote(note.path);

		expect(mockFetch).not.toHaveBeenCalled();
		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'delete' && q.path === note.path)).toBe(true);
	});

	it('does nothing when note path is not found', async () => {
		await store.deleteNote('inbox/nonexistent.md');
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the new `deleteNote` tests to confirm they fail**

```bash
cd /Users/yogeshkumar/Documents/snap-crackle-pop/MyLife
npx vitest run tests/integration/note-crud.test.ts 2>&1 | grep -E 'FAIL|PASS|deleteNote'
```

Expected: the `deleteNote` tests fail (store still has old trash logic).

- [ ] **Step 3: Rewrite `deleteNote` in the store**

Replace lines 174–202 of `src/lib/stores/notes.svelte.ts` (the entire `deleteNote` function) with:

```ts
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
```

- [ ] **Step 4: Remove the `.trash` filter from `getFolderTree`**

Replace line 224 of `src/lib/stores/notes.svelte.ts`:

```ts
// Old:
return buildFolderTree(notes.map((n) => n.path)).filter((f) => f.name !== '.trash');

// New:
return buildFolderTree(notes.map((n) => n.path));
```

- [ ] **Step 5: Run note-crud tests to confirm they pass**

```bash
npx vitest run tests/integration/note-crud.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/notes.svelte.ts tests/integration/note-crud.test.ts
git commit -m "feat: permanently delete notes instead of moving to trash"
```

---

### Task 2: Rewrite `deleteFolder` with TDD

**Files:**
- Modify: `tests/integration/folder-store.test.ts:195-295`
- Modify: `src/lib/stores/notes.svelte.ts:320-373`

- [ ] **Step 1: Replace the `deleteFolder` describe block in the test file**

Replace lines 187–296 of `tests/integration/folder-store.test.ts` (the comment + entire `describe('deleteFolder', ...)` block) with:

```ts
// ── deleteFolder ──────────────────────────────────────────────────────────────

describe('deleteFolder', () => {
	async function setupFolderWithNotes() {
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'n1-sha' } }))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'n2-sha' } }));

		await store.createFolder('old-folder');
		const n1 = await store.createNote('old-folder', 'Note One', 'text');
		const n2 = await store.createNote('old-folder', 'Note Two', 'text');
		mockFetch.mockReset();
		return { n1, n2 };
	}

	it('removes folder from store and getFolderTree immediately', async () => {
		await setupFolderWithNotes();

		mockFetch
			.mockResolvedValueOnce(githubResponse({})) // delete .gitkeep
			.mockResolvedValueOnce(githubResponse({})) // delete note 1
			.mockResolvedValueOnce(githubResponse({})); // delete note 2

		await store.deleteFolder('old-folder');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'old-folder')).toBe(false);
	});

	it('permanently removes notes, not moves to .trash/', async () => {
		await setupFolderWithNotes();

		mockFetch
			.mockResolvedValueOnce(githubResponse({}))
			.mockResolvedValueOnce(githubResponse({}))
			.mockResolvedValueOnce(githubResponse({}));

		await store.deleteFolder('old-folder');

		const notes = store.getNotes();
		expect(notes.some((n) => n.path.startsWith('.trash/'))).toBe(false);
		expect(notes.some((n) => n.path.startsWith('old-folder/'))).toBe(false);
	});

	it('queues delete ops for each file when API fails', async () => {
		await setupFolderWithNotes();
		mockFetch.mockRejectedValue(new Error('network error'));

		await store.deleteFolder('old-folder');

		const queue = await testCache.getSyncQueue();
		const deletes = queue.filter(
			(q) => q.action === 'delete' && q.path.startsWith('old-folder/')
		);
		expect(deletes.length).toBe(3); // .gitkeep + 2 notes
	});

	it('handles deleting an empty folder (only .gitkeep)', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }));
		await store.createFolder('empty-folder');
		mockFetch.mockReset();

		mockFetch.mockResolvedValueOnce(githubResponse({})); // delete .gitkeep

		await store.deleteFolder('empty-folder');

		expect(store.getNotes().some((n) => n.path.startsWith('empty-folder/'))).toBe(false);
		expect(store.getNotes().some((n) => n.path.startsWith('.trash/'))).toBe(false);
	});

	it('queues delete ops and skips API when offline', async () => {
		await setupFolderWithNotes();
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.deleteFolder('old-folder');

		expect(mockFetch).not.toHaveBeenCalled();
		const queue = await testCache.getSyncQueue();
		expect(
			queue.filter((q) => q.action === 'delete' && q.path.startsWith('old-folder/')).length
		).toBe(3);
	});
});
```

- [ ] **Step 2: Run the new `deleteFolder` tests to confirm they fail**

```bash
npx vitest run tests/integration/folder-store.test.ts 2>&1 | grep -E 'FAIL|PASS|deleteFolder'
```

Expected: the `deleteFolder` tests fail.

- [ ] **Step 3: Rewrite `deleteFolder` in the store**

Replace lines 320–373 of `src/lib/stores/notes.svelte.ts` (the entire `deleteFolder` function) with:

```ts
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

- [ ] **Step 4: Run folder-store tests to confirm they pass**

```bash
npx vitest run tests/integration/folder-store.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/notes.svelte.ts tests/integration/folder-store.test.ts
git commit -m "feat: permanently delete folder notes instead of moving to trash"
```

---

### Task 3: Update UI components and related tests

**Files:**
- Modify: `src/lib/components/FolderPanel.svelte:180`
- Modify: `src/lib/components/Sidebar.svelte:167-204` (trash button) and `:289-292` (CSS)
- Modify: `tests/integration/folder-management.test.ts:228,286`

- [ ] **Step 1: Update the confirmation copy in FolderPanel**

In `src/lib/components/FolderPanel.svelte`, replace line 180:

```svelte
<!-- Old: -->
{realNotes.length === 1 ? 'note' : 'notes'} will be moved to trash. Delete

<!-- New: -->
{realNotes.length === 1 ? 'note' : 'notes'} will be permanently deleted. Delete
```

- [ ] **Step 2: Update the confirmation copy assertions in folder-management tests**

In `tests/integration/folder-management.test.ts`, make two changes:

Change line 228:
```ts
// Old:
expect(screen.getByText(/2 notes will be moved to trash/i)).toBeInTheDocument();
// New:
expect(screen.getByText(/2 notes will be permanently deleted/i)).toBeInTheDocument();
```

Change line 286:
```ts
// Old:
expect(screen.queryByText(/will be moved to trash/i)).not.toBeInTheDocument();
// New:
expect(screen.queryByText(/will be permanently deleted/i)).not.toBeInTheDocument();
```

- [ ] **Step 3: Run folder-management tests to confirm they pass**

```bash
npx vitest run tests/integration/folder-management.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Remove the trash button from Sidebar**

In `src/lib/components/Sidebar.svelte`, remove the entire trash button block (lines 167–204 approximately):

```svelte
<!-- Remove this entire block: -->
<button
	class="action-btn trash-btn"
	class:active={selectedFolder === '.trash'}
	onclick={() => onselectfolder?.('.trash')}
	aria-label="Trash"
	title="Trash"
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
		<path d="M19 6l-1 14H6L5 6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
		<path d="M9 6V4h6v2" />
	</svg>
</button>
```

Also remove the `.trash-btn.active` CSS rule (around line 289):

```css
/* Remove this entire rule: */
.trash-btn.active {
	color: var(--accent);
	background: var(--bg-surface);
}
```

- [ ] **Step 5: Run full validate to confirm everything passes**

```bash
npm run validate
```

Expected: 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/FolderPanel.svelte src/lib/components/Sidebar.svelte tests/integration/folder-management.test.ts
git commit -m "feat: remove trash button and update delete confirmation copy"
```

---

### Task 4: Update E2E test and CLAUDE.md

**Files:**
- Modify: `tests/e2e/folder-workflow.spec.ts:242`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the E2E trash-warning text assertion**

In `tests/e2e/folder-workflow.spec.ts`, replace line 242:

```ts
// Old:
await expect(page.getByText(/will be moved to trash/i)).toBeVisible();
// New:
await expect(page.getByText(/will be permanently deleted/i)).toBeVisible();
```

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, find the line:
```
- Soft delete: moves files to `.trash/` folder in repo
```
Replace with:
```
- Delete: permanently removes files via GitHub API
```

- [ ] **Step 3: Run full validate**

```bash
npm run validate
```

Expected: all checks pass.

- [ ] **Step 4: Run E2E tests**

```bash
npm run test:e2e
```

Expected: all E2E tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/folder-workflow.spec.ts CLAUDE.md
git commit -m "chore: update E2E test and docs to reflect permanent deletion"
```
