# Sub-folder Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow top-level folders to contain one level of sub-folders, with creation via an icon button in the folder panel header and always-expanded indented display in the sidebar.

**Architecture:** No store or type changes needed — `Folder.children`, `buildFolderTree`, and `createFolder` already support nested paths. Changes are UI-only: Sidebar renders children, FolderPanel gets icon buttons + sub-folder add flow, +page.svelte owns new state and fixes sub-folder rename, mobile header gets a third icon.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, @testing-library/svelte (integration), Playwright (E2E)

---

## File Map

| File | Change |
|---|---|
| `src/lib/components/Sidebar.svelte` | Render `folder.children` as indented items below each parent |
| `src/lib/components/FolderPanel.svelte` | Convert text buttons to icons; add folder-plus icon + inline sub-folder input; new props |
| `src/routes/+page.svelte` | Add `addingSubfolder`/`subfolderName` state + handlers; fix `handleRename` for sub-folders; add folder-plus to mobile header |
| `tests/integration/subfolder.test.ts` | **New.** Sidebar sub-folder rendering + FolderPanel sub-folder UI tests |
| `tests/e2e/subfolder.spec.ts` | **New.** End-to-end sub-folder creation, selection, rename, delete |

---

## Task 1: Integration tests for Sidebar sub-folder rendering

**Files:**
- Create: `tests/integration/subfolder.test.ts`

- [ ] **Step 1: Create the test file with Sidebar sub-folder tests**

Create `tests/integration/subfolder.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// ── Sidebar sub-folder rendering ─────────────────────────────────────────────

describe('Sidebar with sub-folders', () => {
	const folders = [
		{
			path: 'inbox',
			name: 'inbox',
			children: []
		},
		{
			path: 'work',
			name: 'work',
			children: [
				{ path: 'work/projects', name: 'projects', children: [] },
				{ path: 'work/meetings', name: 'meetings', children: [] }
			]
		}
	];

	it('renders sub-folder names in the list', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders, selectedFolder: null } });

		expect(screen.getByText('projects')).toBeInTheDocument();
		expect(screen.getByText('meetings')).toBeInTheDocument();
	});

	it('sub-folder items have data-folder set to their full path', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders, selectedFolder: null } });

		expect(screen.getByText('projects').closest('[data-folder]')).toHaveAttribute(
			'data-folder',
			'work/projects'
		);
	});

	it('clicking a sub-folder calls onselectfolder with the full path', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const onselectfolder = vi.fn();
		render(Sidebar, { props: { folders, selectedFolder: null, onselectfolder } });

		await fireEvent.click(screen.getByText('projects').closest('[data-folder]')!);

		expect(onselectfolder).toHaveBeenCalledWith('work/projects');
	});

	it('highlights active sub-folder with data-active', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders, selectedFolder: 'work/projects' } });

		const projectsItem = screen.getByText('projects').closest('[data-folder]');
		expect(projectsItem).toHaveAttribute('data-active', 'true');

		const workItem = screen.getByText('work').closest('[data-folder]');
		expect(workItem).toHaveAttribute('data-active', 'false');
	});

	it('does not render sub-folder children (depth capped at 1)', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const foldersWithDeep = [
			{
				path: 'work',
				name: 'work',
				children: [
					{
						path: 'work/projects',
						name: 'projects',
						children: [{ path: 'work/projects/active', name: 'active', children: [] }]
					}
				]
			}
		];
		render(Sidebar, { props: { folders: foldersWithDeep, selectedFolder: null } });

		expect(screen.queryByText('active')).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm run test -- --reporter=verbose tests/integration/subfolder.test.ts
```

Expected: all 5 tests FAIL because Sidebar doesn't render `folder.children`.

---

## Task 2: Update Sidebar.svelte to render sub-folders

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1: Add sub-folder rendering to the folder list template**

In `src/lib/components/Sidebar.svelte`, replace the `{#each folders as folder}` block (lines 71–97):

```svelte
	<ul class="folder-list">
		{#each folders as folder (folder.path)}
			<li>
				<button
					class="folder-item"
					data-folder={folder.path}
					data-active={selectedFolder === folder.path}
					onclick={() => onselectfolder?.(folder.path)}
				>
					<span class="folder-icon">
						<svg
							width="14"
							height="14"
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
					{folder.name}
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
								width="12"
								height="12"
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
						{child.name}
					</button>
				</li>
			{/each}
		{/each}

		{#if adding}
			<li class="folder-add-row">
				<span class="folder-icon">
					<svg
						width="14"
						height="14"
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
```

- [ ] **Step 2: Add subfolder-item CSS to the style block**

Inside the `<style>` block in `src/lib/components/Sidebar.svelte`, add after the `.folder-item` rules:

```css
	.subfolder-item {
		padding-left: 32px;
		font-size: 12px;
	}
```

- [ ] **Step 3: Run subfolder integration tests — expect pass**

```bash
npm run test -- --reporter=verbose tests/integration/subfolder.test.ts
```

Expected: all 5 Sidebar sub-folder tests PASS.

- [ ] **Step 4: Run full test suite — confirm nothing broken**

```bash
npm run test
```

Expected: all 92 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Sidebar.svelte tests/integration/subfolder.test.ts
git commit -m "feat: render sub-folders indented in sidebar"
```

---

## Task 3: Integration tests for FolderPanel icon buttons and sub-folder UI

**Files:**
- Modify: `tests/integration/subfolder.test.ts`

- [ ] **Step 1: Append FolderPanel sub-folder tests**

Append to `tests/integration/subfolder.test.ts`:

```typescript
// ── FolderPanel sub-folder UI ─────────────────────────────────────────────────

describe('FolderPanel sub-folder actions', () => {
	const notes = [
		{ path: 'work/a.md', title: 'A', content: '', type: 'text' as const, pinned: false, updatedAt: '', sha: '' }
	];

	it('shows icon buttons for rename and delete (aria-labels)', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('shows add sub-folder button for a top-level folder', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByRole('button', { name: 'Add sub-folder' })).toBeInTheDocument();
	});

	it('does not show add sub-folder button for a sub-folder', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: {
				folder: 'work/projects',
				notes: [],
				renaming: false,
				renameName: '',
				confirming: false
			}
		});

		expect(screen.queryByRole('button', { name: 'Add sub-folder' })).not.toBeInTheDocument();
	});

	it('calls onstartaddsubfolder when add sub-folder button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartaddsubfolder = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				onstartaddsubfolder
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Add sub-folder' }));

		expect(onstartaddsubfolder).toHaveBeenCalledOnce();
	});

	it('shows inline sub-folder input when addingSubfolder is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: ''
			}
		});

		expect(screen.getByPlaceholderText('sub-folder name')).toBeInTheDocument();
	});

	it('hides action buttons when addingSubfolder is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: ''
			}
		});

		expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Add sub-folder' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
	});

	it('calls onconfirmsubfolder when Enter is pressed in sub-folder input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmsubfolder = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: 'projects',
				onconfirmsubfolder
			}
		});

		await fireEvent.keyDown(screen.getByPlaceholderText('sub-folder name'), { key: 'Enter' });

		expect(onconfirmsubfolder).toHaveBeenCalledOnce();
	});

	it('calls oncancelsubfolder when Escape is pressed in sub-folder input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const oncancelsubfolder = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: '',
				oncancelsubfolder
			}
		});

		await fireEvent.keyDown(screen.getByPlaceholderText('sub-folder name'), { key: 'Escape' });

		expect(oncancelsubfolder).toHaveBeenCalledOnce();
	});

	it('calls onsubfolderinput when typing in the sub-folder input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onsubfolderinput = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: '',
				onsubfolderinput
			}
		});

		await fireEvent.input(screen.getByPlaceholderText('sub-folder name'), {
			target: { value: 'archive' }
		});

		expect(onsubfolderinput).toHaveBeenCalledWith('archive');
	});
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm run test -- --reporter=verbose tests/integration/subfolder.test.ts
```

Expected: the 8 new FolderPanel tests FAIL (FolderPanel still has text buttons and no sub-folder props).

---

## Task 4: Update FolderPanel.svelte

**Files:**
- Modify: `src/lib/components/FolderPanel.svelte`

- [ ] **Step 1: Replace the entire FolderPanel component**

```svelte
<script lang="ts">
	import type { Note } from '$lib/types';

	interface Props {
		folder: string;
		notes: Note[];
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
	}

	let {
		folder,
		notes,
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
		oncancelsubfolder
	}: Props = $props();

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmrename?.();
		if (e.key === 'Escape') oncancelrename?.();
	}

	function handleSubfolderKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmsubfolder?.();
		if (e.key === 'Escape') oncancelsubfolder?.();
	}

	const realNotes = $derived(notes.filter((n) => !n.path.endsWith('.gitkeep')));
	const folderDisplayName = $derived(folder.split('/').pop() ?? folder);
	const isTopLevel = $derived(!folder.includes('/'));

	let subfolderInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (addingSubfolder && subfolderInputEl) subfolderInputEl.focus();
	});
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
				<button class="action-btn icon-btn" onclick={onstartrename} aria-label="Rename" title="Rename">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
				</button>
				{#if isTopLevel}
					<button class="action-btn icon-btn" onclick={onstartaddsubfolder} aria-label="Add sub-folder" title="Add sub-folder">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
							<line x1="12" y1="11" x2="12" y2="17" />
							<line x1="9" y1="14" x2="15" y2="14" />
						</svg>
					</button>
				{/if}
				<button class="action-btn icon-btn danger" onclick={onstartdelete} aria-label="Delete" title="Delete">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
			{#if realNotes.length > 0}
				<span class="confirm-msg">
					{realNotes.length}
					{realNotes.length === 1 ? 'note' : 'notes'} will be moved to trash. Delete
					<strong>{folderDisplayName}</strong>?
				</span>
			{:else}
				<span class="confirm-msg">Delete <strong>{folderDisplayName}</strong>?</span>
			{/if}
			<button class="action-btn danger" onclick={onconfirmdelete} aria-label="Confirm">Confirm</button>
			<button class="action-btn" onclick={oncanceldelete} aria-label="Cancel">Cancel</button>
		</div>
	{/if}

	<div class="note-count">{realNotes.length} {realNotes.length === 1 ? 'note' : 'notes'}</div>

	{#if realNotes.length === 0}
		<p class="empty">No notes in this folder yet.</p>
	{:else}
		<ul class="note-list">
			{#each realNotes as note (note.path)}
				<li class="note-item">{note.title}</li>
			{/each}
		</ul>
	{/if}
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
		padding: 20px 24px 12px;
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
		width: 28px;
		height: 28px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
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

	.note-count {
		padding: 12px 24px 4px;
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-list {
		list-style: none;
		padding: 8px 16px;
		overflow-y: auto;
		flex: 1;
	}

	.note-item {
		padding: 8px 12px;
		font-size: 13px;
		color: var(--text-secondary);
		border-radius: var(--radius);
		margin-bottom: 2px;
		background: var(--bg-base);
	}

	.note-item:hover {
		color: var(--text-primary);
	}

	.empty {
		padding: 24px;
		font-size: 13px;
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

		.note-item {
			min-height: 44px;
			padding: 10px 12px;
			display: flex;
			align-items: center;
		}
	}
</style>
```

- [ ] **Step 2: Run all integration tests — expect pass**

```bash
npm run test -- --reporter=verbose tests/integration/subfolder.test.ts
```

Expected: all 13 tests (5 Sidebar + 8 FolderPanel) PASS.

- [ ] **Step 3: Run full test suite — confirm nothing broken**

```bash
npm run test
```

Expected: all tests pass. The existing FolderPanel tests in `folder-management.test.ts` still pass because aria-labels are unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/FolderPanel.svelte tests/integration/subfolder.test.ts
git commit -m "feat: icon buttons and sub-folder add flow in FolderPanel"
```

---

## Task 5: Wire up +page.svelte

Add `addingSubfolder` state, handlers, fix `handleRename` for sub-folders, pass new props to FolderPanel, and add the folder-plus icon to the mobile header.

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Replace the `<script>` block**

Replace the entire `<script>` block in `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import FolderPanel from '$lib/components/FolderPanel.svelte';
	import {
		getFolderTree,
		getNotesInFolder,
		createFolder,
		renameFolder,
		deleteFolder
	} from '$lib/stores/notes.svelte';
	import {
		getSelectedFolder,
		setSelectedFolder,
		getSidebarOpen,
		setSidebarOpen
	} from '$lib/stores/ui.svelte';

	let folders = $derived(getFolderTree());
	let selectedFolder = $derived(getSelectedFolder());
	let folderNotes = $derived(selectedFolder ? getNotesInFolder(selectedFolder) : []);
	let sidebarOpen = $derived(getSidebarOpen());

	// Rename / confirm / sub-folder state owned here so both desktop and mobile header can drive it
	let renaming = $state(false);
	let renameName = $state('');
	let confirming = $state(false);
	let addingSubfolder = $state(false);
	let subfolderName = $state('');

	// Reset interaction state whenever the active folder changes
	let prevFolder: string | null = null;
	$effect(() => {
		if (selectedFolder !== prevFolder) {
			renaming = false;
			confirming = false;
			addingSubfolder = false;
			prevFolder = selectedFolder;
		}
	});

	function startRename() {
		renameName = selectedFolder?.split('/').pop() ?? '';
		renaming = true;
		confirming = false;
		addingSubfolder = false;
	}

	function confirmRename() {
		const name = renameName.trim();
		if (name && name !== selectedFolder?.split('/').pop()) handleRename(name);
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
		if (selectedFolder) await handleDelete(selectedFolder);
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
		if (name && selectedFolder) {
			const path = `${selectedFolder}/${name}`;
			await createFolder(path);
			setSelectedFolder(path);
		}
	}

	async function handleCreateFolder(name: string) {
		await createFolder(name);
		setSelectedFolder(name);
		setSidebarOpen(false);
	}

	async function handleRename(newName: string) {
		if (!selectedFolder) return;
		const parts = selectedFolder.split('/');
		const fullNewPath =
			parts.length > 1 ? `${parts.slice(0, -1).join('/')}/${newName}` : newName;
		await renameFolder(selectedFolder, fullNewPath);
		setSelectedFolder(fullNewPath);
	}

	async function handleDelete(folder: string) {
		await deleteFolder(folder);
		setSelectedFolder(null);
	}

	function handleSelectFolder(path: string) {
		setSelectedFolder(path);
		setSidebarOpen(false);
	}

	const folderDisplayName = $derived(selectedFolder?.split('/').pop() ?? '');
	const selectedIsTopLevel = $derived(!!selectedFolder && !selectedFolder.includes('/'));
</script>
```

- [ ] **Step 2: Update the FolderPanel call in the template**

Replace the existing `<FolderPanel ... />` block:

```svelte
			<FolderPanel
				folder={selectedFolder}
				notes={folderNotes}
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
			/>
```

- [ ] **Step 3: Update the mobile header to add the folder-plus icon**

Replace the `{:else if selectedFolder}` branch inside `.mobile-header`:

```svelte
			{:else if selectedFolder}
				<span class="app-title" role="heading" aria-level="2">{folderDisplayName}</span>
				{#if !confirming && !addingSubfolder}
					<button class="header-icon-btn" onclick={startRename} aria-label="Rename">
						<svg
							width="17"
							height="17"
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
								width="17"
								height="17"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
								<line x1="12" y1="11" x2="12" y2="17" />
								<line x1="9" y1="14" x2="15" y2="14" />
							</svg>
						</button>
					{/if}
					<button class="header-icon-btn danger" onclick={startDelete} aria-label="Delete">
						<svg
							width="17"
							height="17"
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
```

- [ ] **Step 4: Run validate**

```bash
npm run validate
```

Expected: all tests pass, no type errors, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: wire sub-folder state and fix sub-folder rename in page"
```

---

## Task 6: E2E sub-folder tests

**Files:**
- Create: `tests/e2e/subfolder.spec.ts`

- [ ] **Step 1: Create the E2E test file**

Create `tests/e2e/subfolder.spec.ts`:

```typescript
import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

async function mockGitHub(page: Page, files: { path: string; content: string; sha: string }[] = []) {
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
				body: JSON.stringify({ content: { sha: 'new-sha' } })
			});
		}

		if (method === 'DELETE') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		}

		return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
}

async function setupApp(page: Page, files: { path: string; content: string; sha: string }[] = []) {
	await mockGitHub(page, files);
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
	await page.fill('input[type="password"]', 'fake-token');
	await page.fill('input[type="text"]', REPO);
	await page.getByRole('button', { name: /connect/i }).click();
	await page.waitForURL('/', { timeout: 10_000 });
}

test.describe('sub-folder support', () => {
	test('sub-folders appear indented under their parent in the sidebar', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		// Parent visible
		await expect(page.locator('[data-folder="work"]')).toBeVisible();
		// Sub-folder visible and has full path
		await expect(page.locator('[data-folder="work/projects"]')).toBeVisible();
	});

	test('clicking a sub-folder in the sidebar shows its folder panel', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await page.locator('[data-folder="work/projects"]').click();

		// FolderPanel header shows sub-folder name
		await expect(page.getByRole('heading', { name: 'projects' })).toBeVisible();
	});

	test('sub-folder panel does not show add sub-folder button', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await page.locator('[data-folder="work/projects"]').click();

		await expect(page.getByRole('button', { name: 'Add sub-folder' })).not.toBeVisible();
	});

	test('top-level folder panel shows add sub-folder button', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();

		await expect(page.getByRole('button', { name: 'Add sub-folder' })).toBeVisible();
	});

	test('creating a sub-folder from the panel adds it to the sidebar', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.getByRole('button', { name: 'Add sub-folder' }).click();

		const input = page.locator('.subfolder-input');
		await expect(input).toBeVisible();
		await input.fill('archive');
		await input.press('Enter');

		// Sub-folder appears in sidebar
		await expect(page.locator('[data-folder="work/archive"]')).toBeVisible();
	});

	test('after creating a sub-folder, its panel is selected', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.getByRole('button', { name: 'Add sub-folder' }).click();

		await page.locator('.subfolder-input').fill('archive');
		await page.locator('.subfolder-input').press('Enter');

		// Panel heading shows sub-folder name
		await expect(page.getByRole('heading', { name: 'archive' })).toBeVisible();
	});

	test('cancelling sub-folder input with Escape does not create a folder', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.getByRole('button', { name: 'Add sub-folder' }).click();

		await page.locator('.subfolder-input').fill('archive');
		await page.locator('.subfolder-input').press('Escape');

		// Input gone, no sub-folder in sidebar
		await expect(page.locator('.subfolder-input')).not.toBeVisible();
		await expect(page.locator('[data-folder="work/archive"]')).not.toBeVisible();
	});

	test('renaming a sub-folder keeps it under the same parent', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await page.locator('[data-folder="work/projects"]').click();
		await page.getByRole('button', { name: 'Rename' }).click();

		const input = page.locator('.rename-input');
		await input.fill('archive');
		await input.press('Enter');

		// Renamed to work/archive (not top-level 'archive')
		await expect(page.locator('[data-folder="work/archive"]')).toBeVisible();
		await expect(page.locator('[data-folder="archive"]')).not.toBeVisible();
	});
});
```

- [ ] **Step 2: Run the E2E tests (requires dev server running in another terminal)**

```bash
npm run test:e2e -- tests/e2e/subfolder.spec.ts
```

Expected: all 8 tests pass.

- [ ] **Step 3: Run full validate**

```bash
npm run validate
```

Expected: all unit/integration tests + E2E pass, no type/lint errors.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/subfolder.spec.ts
git commit -m "test: add E2E tests for sub-folder creation, selection, rename"
```

---

## Self-Review

**Spec coverage:**
- ✅ Sidebar always-expanded tree — Task 2
- ✅ Depth capped at 1 (test in Task 1, `isTopLevel` derived in Task 4) — Tasks 1, 3, 4
- ✅ FolderPanel all-icon buttons (pencil, folder-plus, trash) — Task 4
- ✅ Folder-plus hidden for sub-folders — Tasks 3, 4 (`isTopLevel` guard)
- ✅ Inline sub-folder input below header — Task 4
- ✅ Auto-focus sub-folder input on open — Task 4 (`$effect` + `bind:this`)
- ✅ `addingSubfolder` state in +page.svelte — Task 5
- ✅ `confirmAddSubfolder` calls `createFolder(parent/name)` — Task 5
- ✅ `handleRename` preserves parent path for sub-folders — Task 5
- ✅ Mobile header: folder-plus icon only for top-level — Task 5
- ✅ State resets on folder change — Task 5 (`$effect` block includes `addingSubfolder`)
- ✅ Integration tests: Sidebar rendering + FolderPanel props — Tasks 1, 3
- ✅ E2E: create, select, rename sub-folder — Task 6

**No placeholders:** All steps contain complete code.

**Type consistency:**
- `addingSubfolder` / `subfolderName` — optional with defaults in FolderPanel (Tasks 4, 5 consistent)
- `onstartaddsubfolder` / `onsubfolderinput` / `onconfirmsubfolder` / `oncancelsubfolder` — names consistent across Tasks 3, 4, 5
- `selectedIsTopLevel` derived from `selectedFolder.includes('/')` — used in Task 5 template
- `isTopLevel` derived in FolderPanel from `folder.includes('/')` — used in Task 4 template
