# Folder Note Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-note list in each folder with a single full-height textarea editor backed by `index.md`.

**Architecture:** Each folder owns one `{folder}/index.md` file. `createFolder` creates this file instead of `.gitkeep`. `FolderPanel` renders a debounced textarea that calls `updateNote` on change. `+page.svelte` wires `getFolderNote` → `FolderPanel` and handles the save callback.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Vitest + @testing-library/svelte, Playwright, idb-keyval (via NoteCache mock)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/stores/notes.svelte.ts` | `createFolder` uses `index.md`; add `getFolderNote` |
| `src/lib/components/FolderPanel.svelte` | Replace note list with textarea; new `note`/`onsave` props |
| `src/routes/+page.svelte` | Use `getFolderNote`, add `handleSave`, update FolderPanel props |
| `tests/integration/folder-store.test.ts` | Update `.gitkeep` → `index.md`; add `getFolderNote` tests |
| `tests/integration/folder-management.test.ts` | Update FolderPanel tests (remove note list; add textarea) |
| `tests/e2e/folder-workflow.spec.ts` | Update fixture paths `.gitkeep` → `index.md` |
| `tests/e2e/subfolder.spec.ts` | Update fixture paths `.gitkeep` → `index.md` |
| `tests/e2e/mobile-layout.spec.ts` | Update fixture paths `.gitkeep` → `index.md` |

---

## Task 1: Update createFolder to use index.md

**Files:**
- Modify: `tests/integration/folder-store.test.ts`
- Modify: `src/lib/stores/notes.svelte.ts`

- [ ] **Step 1: Update the store tests to expect index.md instead of .gitkeep**

Replace every occurrence of `.gitkeep` in `tests/integration/folder-store.test.ts`. The diffs below are exhaustive — apply them all before running tests.

In `describe('createFolder')`:
```ts
// Line 28: change test name and path
it('adds index.md placeholder to store immediately', async () => {
  mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }));

  await store.createFolder('projects');

  const notes = store.getNotes();
  expect(notes.some((n) => n.path === 'projects/index.md')).toBe(true);
});

// Line 46: change test name and path
it('patches index.md SHA after API succeeds', async () => {
  mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'real-sha' } }));

  await store.createFolder('ideas');

  const gk = store.getNotes().find((n) => n.path === 'ideas/index.md');
  expect(gk?.sha).toBe('real-sha');
});

// Line 55: change path in queue assertion
it('queues create op when API fails', async () => {
  mockFetch.mockRejectedValueOnce(new Error('server error'));
  mockFetch.mockRejectedValueOnce(new Error('not found'));

  await store.createFolder('drafts');

  expect(store.getNotes().some((n) => n.path === 'drafts/index.md')).toBe(true);

  const queue = await testCache.getSyncQueue();
  expect(queue.some((q) => q.action === 'create' && q.path === 'drafts/index.md')).toBe(true);
});

// Line 68: change path in queue assertion
it('queues op and skips API when offline', async () => {
  Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

  await store.createFolder('offline-folder');

  expect(mockFetch).not.toHaveBeenCalled();

  const queue = await testCache.getSyncQueue();
  expect(queue.some((q) => q.path === 'offline-folder/index.md')).toBe(true);
});

// Line 79: change paths in duplicate check
it('does not add duplicate index.md if folder already exists', async () => {
  mockFetch
    .mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }))
    .mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));

  await store.createFolder('dedupe');
  await store.createFolder('dedupe');

  const idxNotes = store.getNotes().filter((n) => n.path === 'dedupe/index.md');
  expect(idxNotes.length).toBe(1);
});
```

Also update `setupFolderWithNotes` inside `describe('renameFolder')` and `describe('deleteFolder')` — both have comments referencing `.gitkeep`. Change the comment on line 97 from `// createFolder` and the assertion on line 111 from checking `.gitkeep` (there is no direct path assertion there, just count — so only the comment needs changing). The `deleteFolder` test on line 207 says `// delete .gitkeep` — change to `// delete index.md`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --reporter=verbose tests/integration/folder-store.test.ts
```

Expected: Multiple FAIL — tests expect `index.md` but store still creates `.gitkeep`.

- [ ] **Step 3: Update createFolder in the store**

In `src/lib/stores/notes.svelte.ts`, find `createFolder` (line 218). Change one line:

```ts
export async function createFolder(name: string): Promise<void> {
	const path = `${name}/index.md`;   // was: `${name}/.gitkeep`
```

The rest of the function body is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose tests/integration/folder-store.test.ts
```

Expected: All tests in `folder-store.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/notes.svelte.ts tests/integration/folder-store.test.ts
git commit -m "feat: createFolder uses index.md instead of .gitkeep"
```

---

## Task 2: Add getFolderNote export

**Files:**
- Modify: `tests/integration/folder-store.test.ts`
- Modify: `src/lib/stores/notes.svelte.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block at the end of `tests/integration/folder-store.test.ts`:

```ts
// ── getFolderNote ─────────────────────────────────────────────────────────────

describe('getFolderNote', () => {
	it('returns the index.md note for a folder that exists', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'idx-sha' } }));
		await store.createFolder('journal');

		const note = store.getFolderNote('journal');

		expect(note).not.toBeNull();
		expect(note?.path).toBe('journal/index.md');
	});

	it('returns null for a folder that has not been created', () => {
		expect(store.getFolderNote('nonexistent')).toBeNull();
	});

	it('returns the note after renaming the folder', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } })); // createFolder
		await store.createFolder('old');
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } })) // create new path
			.mockResolvedValueOnce(githubResponse({})); // delete old path

		await store.renameFolder('old', 'new');

		expect(store.getFolderNote('old')).toBeNull();
		expect(store.getFolderNote('new')?.path).toBe('new/index.md');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --reporter=verbose tests/integration/folder-store.test.ts
```

Expected: FAIL — `store.getFolderNote is not a function`.

- [ ] **Step 3: Implement getFolderNote**

Add this export to `src/lib/stores/notes.svelte.ts` after the `getPinnedNotes` function (after line 201):

```ts
export function getFolderNote(folder: string): Note | null {
	return notes.find((n) => n.path === `${folder}/index.md`) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose tests/integration/folder-store.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/notes.svelte.ts tests/integration/folder-store.test.ts
git commit -m "feat: add getFolderNote store helper"
```

---

## Task 3: Rewrite FolderPanel with textarea editor

**Files:**
- Modify: `tests/integration/folder-management.test.ts`
- Modify: `src/lib/components/FolderPanel.svelte`

- [ ] **Step 1: Update existing FolderPanel tests to use the new note prop**

In `tests/integration/folder-management.test.ts`, make the following changes:

**Update the buildFolderTree test** (lines 14-22) — change `.gitkeep` to `index.md`:

```ts
describe('buildFolderTree with index.md placeholder', () => {
	it('includes an empty folder created by an index.md file', () => {
		const paths = ['inbox/note.md', 'projects/index.md'];
		const tree = buildFolderTree(paths);
		expect(tree.map((f) => f.name)).toContain('projects');
	});
});
```

**Delete these four tests entirely** from `describe('FolderPanel')` — they test behaviour that will no longer exist:
- `'shows the folder name and note count'`
- `'lists note titles inside the folder'`
- `'shows empty state when folder has no notes'`
- `'does not show trash warning when folder is empty'`

**Update the remaining FolderPanel tests** — change `notes` prop to `note` (singular, a `Note | null`). The shared `notes` array at line 90–93 should be replaced. Update each test that previously passed `notes`:

```ts
// Replace the shared notes array at lines 90-93 with:
const note = createTestNote({ path: 'work/index.md', content: 'hello' });
```

Then for every `render(FolderPanel, { props: { folder: 'work', notes, ... } })` call, change `notes` to `note`:

```ts
// Example: the rename test
render(FolderPanel, {
  props: { folder: 'work', note, renaming: false, renameName: '', confirming: false, onstartrename }
});
```

**Update the delete confirmation test** — it currently checks for "2 notes will be permanently deleted". The new confirm bar just shows "Delete work?". Replace:

```ts
it('shows delete confirmation when confirming prop is true', async () => {
  const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
  render(FolderPanel, {
    props: { folder: 'work', note, renaming: false, renameName: '', confirming: true }
  });

  expect(screen.getByText(/delete/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add new FolderPanel tests for the textarea**

Add these four tests at the end of `describe('FolderPanel')` in `folder-management.test.ts`:

```ts
it('renders a textarea with the note content', async () => {
  const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
  const n = createTestNote({ path: 'work/index.md', content: 'my notes here' });
  render(FolderPanel, {
    props: { folder: 'work', note: n, renaming: false, renameName: '', confirming: false }
  });

  expect(screen.getByRole('textbox')).toHaveValue('my notes here');
});

it('renders an empty textarea when note is null', async () => {
  const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
  render(FolderPanel, {
    props: { folder: 'work', note: null, renaming: false, renameName: '', confirming: false }
  });

  expect(screen.getByRole('textbox')).toHaveValue('');
});

it('calls onsave 800ms after typing stops', async () => {
  vi.useFakeTimers();
  const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
  const onsave = vi.fn();
  const n = createTestNote({ path: 'work/index.md', content: '' });
  render(FolderPanel, {
    props: { folder: 'work', note: n, renaming: false, renameName: '', confirming: false, onsave }
  });

  await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'hello world' } });
  expect(onsave).not.toHaveBeenCalled();

  vi.advanceTimersByTime(800);
  expect(onsave).toHaveBeenCalledWith('hello world');

  vi.useRealTimers();
});

it('debounces rapid typing — only calls onsave once', async () => {
  vi.useFakeTimers();
  const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
  const onsave = vi.fn();
  const n = createTestNote({ path: 'work/index.md', content: '' });
  render(FolderPanel, {
    props: { folder: 'work', note: n, renaming: false, renameName: '', confirming: false, onsave }
  });

  await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'h' } });
  vi.advanceTimersByTime(400);
  await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'hello' } });
  vi.advanceTimersByTime(800);

  expect(onsave).toHaveBeenCalledTimes(1);
  expect(onsave).toHaveBeenCalledWith('hello');

  vi.useRealTimers();
});
```

- [ ] **Step 3: Run tests to verify the new tests fail**

```bash
npm run test -- --reporter=verbose tests/integration/folder-management.test.ts
```

Expected: New textarea tests FAIL (component still has old note list). Other tests also fail (wrong prop shape).

- [ ] **Step 4: Rewrite FolderPanel.svelte**

Replace the entire contents of `src/lib/components/FolderPanel.svelte` with:

```svelte
<script lang="ts">
	import type { Note } from '$lib/types';

	interface Props {
		folder: string;
		note: Note | null;
		renaming: boolean;
		renameName: string;
		confirming: boolean;
		addingSubfolder?: boolean;
		subfolderName?: string;
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
	}

	let {
		folder,
		note,
		renaming,
		renameName,
		confirming,
		addingSubfolder = false,
		subfolderName = '',
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
		onsave
	}: Props = $props();

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmrename?.();
		if (e.key === 'Escape') oncancelrename?.();
	}

	function handleSubfolderKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmsubfolder?.();
		if (e.key === 'Escape') oncancelsubfolder?.();
	}

	const folderDisplayName = $derived(folder.split('/').pop() ?? folder);
	const isTopLevel = $derived(!folder.includes('/'));

	let subfolderInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (addingSubfolder && subfolderInputEl) subfolderInputEl.focus();
	});

	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	// Cancel pending save when folder changes to avoid writing to the wrong note
	$effect(() => {
		folder;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
	});

	function handleInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			onsave?.(value);
		}, 800);
	}
</script>

<div class="panel">
	<header class="panel-header">
		{#if renaming}
			<input
				class="rename-input"
				value={renameName}
				oninput={(e) => onrenameinput?.((e.target as HTMLInputElement).value)}
				onkeydown={handleRenameKey}
				onblur={() => oncancelrename?.()}
			/>
		{:else}
			<h2 class="folder-title">{folderDisplayName}</h2>
		{/if}

		<div class="actions">
			{#if !renaming && !confirming && !addingSubfolder}
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
			{/if}
		</div>
	</header>

	{#if addingSubfolder}
		<div class="subfolder-add-row">
			<span class="subfolder-icon">
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
				bind:this={subfolderInputEl}
				class="subfolder-input"
				placeholder="sub-folder name"
				value={subfolderName}
				oninput={(e) => onsubfolderinput?.((e.target as HTMLInputElement).value)}
				onkeydown={handleSubfolderKey}
				onblur={() => oncancelsubfolder?.()}
			/>
		</div>
	{/if}

	{#if confirming}
		<div class="confirm-bar">
			<span class="confirm-msg">Delete <strong>{folderDisplayName}</strong>?</span>
			<button class="action-btn danger" onclick={onconfirmdelete} aria-label="Confirm">Confirm</button>
			<button class="action-btn" onclick={oncanceldelete} aria-label="Cancel">Cancel</button>
		</div>
	{/if}

	<textarea
		class="note-editor"
		value={note?.content ?? ''}
		oninput={handleInput}
		placeholder="Start writing..."
	></textarea>
</div>

<style>
	.panel {
		flex: 1;
		height: 100%;
		background: var(--bg-surface);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 2px 2px 5px;
		border-bottom: 1px solid var(--border);
		gap: 12px;
	}

	.folder-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.rename-input {
		font-size: 18px;
		font-weight: 600;
		padding: 2px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-base);
		flex: 1;
	}

	.actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		font-size: 12px;
		padding: 4px 10px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		background: var(--bg-base);
		transition:
			border-color 0.1s,
			color 0.1s;
	}

	.action-btn:hover {
		border-color: var(--text-secondary);
		color: var(--text-primary);
	}

	.action-btn.danger {
		color: var(--danger);
		border-color: var(--danger);
	}

	.action-btn.danger:hover {
		background: var(--danger);
		color: var(--bg-base);
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.icon-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
		border: none;
	}

	.icon-btn.danger {
		border: none;
	}

	.icon-btn.danger:hover {
		background: var(--bg-surface);
		color: var(--danger);
	}

	.subfolder-add-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-base);
	}

	.subfolder-icon {
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.subfolder-input {
		flex: 1;
		font-size: 13px;
		padding: 4px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.confirm-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 24px;
		background: var(--bg-base);
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.confirm-msg {
		flex: 1;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.note-editor {
		flex: 1;
		width: 100%;
		padding: 16px 24px;
		background: var(--bg-surface);
		border: none;
		resize: none;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-primary);
		outline: none;
		box-sizing: border-box;
	}

	.note-editor::placeholder {
		color: var(--text-muted);
	}

	@media (max-width: 768px) {
		.panel-header {
			display: none;
		}

		.action-btn {
			min-height: 44px;
			padding: 10px 14px;
		}

		.icon-btn {
			min-height: 44px;
			width: 44px;
			padding: 0;
		}
	}
</style>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose tests/integration/folder-management.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/FolderPanel.svelte tests/integration/folder-management.test.ts
git commit -m "feat: replace note list with textarea editor in FolderPanel"
```

---

## Task 4: Wire +page.svelte and update E2E fixtures

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `tests/e2e/folder-workflow.spec.ts`
- Modify: `tests/e2e/subfolder.spec.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`

- [ ] **Step 1: Update +page.svelte imports**

In `src/routes/+page.svelte`, replace the import block:

```ts
import {
	getFolderTree,
	getFolderNote,
	updateNote,
	createFolder,
	renameFolder,
	deleteFolder
} from '$lib/stores/notes.svelte';
```

- [ ] **Step 2: Replace folderNotes with folderNote**

Remove this line:
```ts
let folderNotes = $derived(selectedFolder ? getNotesInFolder(selectedFolder) : []);
```

Add this line:
```ts
let folderNote = $derived(selectedFolder ? getFolderNote(selectedFolder) : null);
```

- [ ] **Step 3: Add handleSave function**

Add this function after `handleSelectFolder`:

```ts
async function handleSave(content: string) {
	const note = getFolderNote(selectedFolder!);
	if (!note) return;
	await updateNote(note.path, content);
}
```

- [ ] **Step 4: Update FolderPanel usage in the template**

Find the `<FolderPanel` block and replace `notes={folderNotes}` with `note={folderNote}` and add `onsave={handleSave}`:

```svelte
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
```

- [ ] **Step 5: Update E2E test fixtures — replace .gitkeep with index.md**

In all three E2E files, replace every `/.gitkeep` occurrence with `/index.md`. This is a bulk find-and-replace:

```bash
sed -i '' 's|\.gitkeep|index.md|g' \
  tests/e2e/folder-workflow.spec.ts \
  tests/e2e/subfolder.spec.ts \
  tests/e2e/mobile-layout.spec.ts
```

- [ ] **Step 6: Update E2E tests that assert on removed UI**

In `tests/e2e/folder-workflow.spec.ts`, make these targeted changes:

**Delete** the `'folder panel shows the correct note count'` test entirely (lines 172–181) — note counts are gone.

**Replace** `'empty folder shows "no notes" message'` with a textarea placeholder check:

```ts
test('empty folder shows textarea with placeholder', async ({ page }) => {
  await setupApp(page, [{ path: 'empty/index.md', content: '', sha: 'gk' }]);

  await page.locator('[data-folder]').filter({ hasText: 'empty' }).click();
  await expect(page.locator('.note-editor')).toBeVisible();
});
```

**Replace** `'note titles are listed inside the folder panel'` with a content check:

```ts
test('folder panel shows index.md content in textarea', async ({ page }) => {
  await setupApp(page, [
    { path: 'ideas/index.md', content: 'My first idea', sha: 'sha-1' }
  ]);

  await page.locator('[data-folder]').filter({ hasText: 'ideas' }).click();
  await expect(page.locator('.note-editor')).toHaveValue('My first idea');
});
```

**Replace** `'deleting folder with notes shows trash warning with count'` — the confirm dialog no longer shows a note count:

```ts
test('deleting folder shows confirmation dialog', async ({ page }) => {
  await setupApp(page, [{ path: 'to-delete/index.md', content: '', sha: 'gk' }]);

  await page.locator('[data-folder]').filter({ hasText: 'to-delete' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.locator('.confirm-msg')).toContainText('to-delete');
  await expect(page.getByRole('button', { name: /confirm/i })).toBeVisible();
});
```

- [ ] **Step 7: Run full validation**

```bash
npm run validate
```

Expected: All checks pass (type check, lint, format, 104+ unit/integration tests).

- [ ] **Step 8: Commit**

```bash
git add src/routes/+page.svelte tests/e2e/folder-workflow.spec.ts tests/e2e/subfolder.spec.ts tests/e2e/mobile-layout.spec.ts
git commit -m "feat: wire folder note editor into page and update E2E fixtures"
```
