# Mobile Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the two stacked mobile bars (app title + folder panel header) into one unified 48px bar that shows the folder name and icon buttons for rename/delete.

**Architecture:** Lift rename/confirm state from `FolderPanel` up to `+page.svelte` so the mobile header can drive those interactions. `FolderPanel` becomes props-driven; its `.panel-header` is hidden on mobile via CSS. Desktop behaviour is unchanged.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, @testing-library/svelte (integration), Playwright (E2E)

---

## File Map

| File | Change |
|---|---|
| `src/lib/components/FolderPanel.svelte` | Remove internal rename/confirm state; accept as props; hide `.panel-header` on mobile |
| `src/routes/+page.svelte` | Own rename/confirm state; extend mobile header with folder name + icons |
| `tests/integration/folder-management.test.ts` | Replace click-to-rename/delete tests with props-driven equivalents |
| `tests/e2e/mobile-layout.spec.ts` | Update heading assertion; add rename + delete E2E tests at 375px |

---

## Task 1: Refactor FolderPanel integration tests to match new props API

The existing tests click "Rename"/"Delete" and observe internal state. After the refactor those buttons call callbacks; state lives in the parent. Rewrite the FolderPanel tests first so they fail — then fix them in Task 2.

**Files:**
- Modify: `tests/integration/folder-management.test.ts:111-183`

- [ ] **Step 1: Replace the FolderPanel describe block**

Replace lines 89–183 of `tests/integration/folder-management.test.ts` (the `describe('FolderPanel', ...)` block) with the following. Leave everything above line 88 untouched.

```typescript
describe('FolderPanel', () => {
	const notes = [
		createTestNote({ path: 'work/task.md' }),
		createTestNote({ path: 'work/meeting.md' })
	];

	it('shows the folder name and note count', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByText('work')).toBeInTheDocument();
		expect(screen.getByText(/2 notes/i)).toBeInTheDocument();
	});

	it('lists note titles inside the folder', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByText(notes[0].title)).toBeInTheDocument();
		expect(screen.getByText(notes[1].title)).toBeInTheDocument();
	});

	it('calls onstartrename when Rename button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				onstartrename
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /rename/i }));

		expect(onstartrename).toHaveBeenCalledOnce();
	});

	it('shows rename input when renaming prop is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: true, renameName: 'work', confirming: false }
		});

		expect(screen.getByDisplayValue('work')).toBeInTheDocument();
	});

	it('calls onconfirmrename when Enter is pressed in rename input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: true,
				renameName: 'projects',
				confirming: false,
				onconfirmrename
			}
		});

		const input = screen.getByDisplayValue('projects');
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(onconfirmrename).toHaveBeenCalledOnce();
	});

	it('calls oncancelrename when Escape is pressed in rename input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const oncancelrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: true,
				renameName: 'work',
				confirming: false,
				oncancelrename
			}
		});

		const input = screen.getByDisplayValue('work');
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(oncancelrename).toHaveBeenCalledOnce();
	});

	it('calls onstartdelete when Delete button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartdelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				onstartdelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /delete/i }));

		expect(onstartdelete).toHaveBeenCalledOnce();
	});

	it('shows delete confirmation when confirming prop is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: true }
		});

		expect(screen.getByText(/2 notes will be moved to trash/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
	});

	it('calls onconfirmdelete when Confirm is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmdelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: true,
				onconfirmdelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

		expect(onconfirmdelete).toHaveBeenCalledOnce();
	});

	it('calls oncanceldelete when Cancel is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const oncanceldelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: true,
				oncanceldelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

		expect(oncanceldelete).toHaveBeenCalledOnce();
	});

	it('shows empty state when folder has no notes', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'empty', notes: [], renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByText(/no notes/i)).toBeInTheDocument();
	});

	it('does not show trash warning when folder is empty', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'empty', notes: [], renaming: false, renameName: '', confirming: true }
		});

		expect(screen.queryByText(/will be moved to trash/i)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
	});

	// GitHub API tests for createFolder, renameFolder, deleteFolder
	describe('createFolder via GitHubClient', () => {
		it('creates a .gitkeep placeholder file in the new folder', async () => {
			const { GitHubClient } = await import('$lib/github');
			const client = new GitHubClient('token', 'user/repo');
			mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'abc' } }));

			await client.createFile('projects/.gitkeep', '');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/contents/projects/.gitkeep'),
				expect.objectContaining({ method: 'PUT' })
			);
		});
	});
});
```

- [ ] **Step 2: Run the tests — expect failures**

```bash
npm run test -- --reporter=verbose 2>&1 | grep -A2 "FolderPanel"
```

Expected: several FAIL lines because FolderPanel still has internal state and the old prop API.

---

## Task 2: Refactor FolderPanel to accept state as props

Remove internal `renaming`/`renameName`/`confirming` state. Receive them as props and fire callbacks.

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
		onstartrename?: () => void;
		onstartdelete?: () => void;
		onrenameinput?: (value: string) => void;
		onconfirmrename?: () => void;
		oncancelrename?: () => void;
		onconfirmdelete?: () => void;
		oncanceldelete?: () => void;
	}

	let {
		folder,
		notes,
		renaming,
		renameName,
		confirming,
		onstartrename,
		onstartdelete,
		onrenameinput,
		onconfirmrename,
		oncancelrename,
		onconfirmdelete,
		oncanceldelete
	}: Props = $props();

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmrename?.();
		if (e.key === 'Escape') oncancelrename?.();
	}

	const realNotes = $derived(notes.filter((n) => !n.path.endsWith('.gitkeep')));
	const folderDisplayName = $derived(folder.split('/').pop() ?? folder);
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
			{#if !renaming && !confirming}
				<button class="action-btn" onclick={onstartrename} aria-label="Rename">Rename</button>
				<button class="action-btn danger" onclick={onstartdelete} aria-label="Delete">Delete</button>
			{/if}
		</div>
	</header>

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
			<button class="action-btn danger" onclick={onconfirmdelete} aria-label="Confirm"
				>Confirm</button
			>
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
		gap: 8px;
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

		.note-item {
			min-height: 44px;
			padding: 10px 12px;
			display: flex;
			align-items: center;
		}
	}
</style>
```

- [ ] **Step 2: Run integration tests — expect them to pass**

```bash
npm run test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|FolderPanel)"
```

Expected: all FolderPanel tests PASS.

- [ ] **Step 3: Run full test suite — note any other failures**

```bash
npm run test
```

Expected: all 88 tests pass (the component API changed but tests were updated in Task 1).

---

## Task 3: Lift rename/confirm state into +page.svelte and wire up FolderPanel

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add state and handlers to +page.svelte script block**

Replace the existing `<script>` block (lines 1–43) with:

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

	// Rename / confirm state owned here so the mobile header can drive it
	let renaming = $state(false);
	let renameName = $state('');
	let confirming = $state(false);

	// Reset interaction state whenever the active folder changes
	$effect(() => {
		if (selectedFolder !== undefined) {
			renaming = false;
			confirming = false;
		}
	});

	function startRename() {
		renameName = selectedFolder?.split('/').pop() ?? '';
		renaming = true;
		confirming = false;
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
	}

	function cancelDelete() {
		confirming = false;
	}

	async function confirmDelete() {
		confirming = false;
		if (selectedFolder) await handleDelete(selectedFolder);
	}

	async function handleCreateFolder(name: string) {
		await createFolder(name);
		setSelectedFolder(name);
		setSidebarOpen(false);
	}

	async function handleRename(newName: string) {
		if (!selectedFolder) return;
		await renameFolder(selectedFolder, newName);
		setSelectedFolder(newName);
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
</script>
```

- [ ] **Step 2: Update the FolderPanel call in the template**

Replace the `<FolderPanel ... />` block (currently lines ~80–87):

```svelte
		<FolderPanel
			folder={selectedFolder}
			notes={folderNotes}
			{renaming}
			{renameName}
			{confirming}
			onstartrename={startRename}
			onstartdelete={startDelete}
			onrenameinput={(v) => (renameName = v)}
			onconfirmrename={confirmRename}
			oncancelrename={cancelRename}
			onconfirmdelete={confirmDelete}
			oncanceldelete={cancelDelete}
		/>
```

- [ ] **Step 3: Run tests**

```bash
npm run test
```

Expected: all tests pass. The desktop flow is now wired through +page.svelte state.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/FolderPanel.svelte src/routes/+page.svelte tests/integration/folder-management.test.ts
git commit -m "refactor: lift rename/confirm state from FolderPanel to page"
```

---

## Task 4: Update mobile header to show folder name + action icons

**Files:**
- Modify: `src/routes/+page.svelte` (template + styles only)

- [ ] **Step 1: Replace the mobile-header div in the template**

Replace the existing `.mobile-header` block:

```svelte
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

			{#if selectedFolder && renaming}
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
				<button class="header-icon-btn confirm" onclick={confirmRename} aria-label="Confirm rename">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</button>
				<button class="header-icon-btn" onclick={cancelRename} aria-label="Cancel rename">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{:else if selectedFolder}
				<span class="app-title" role="heading" aria-level="2">{folderDisplayName}</span>
				<button class="header-icon-btn" onclick={startRename} aria-label="Rename">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
				</button>
				<button class="header-icon-btn danger" onclick={startDelete} aria-label="Delete">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
						<path d="M10 11v6" />
						<path d="M14 11v6" />
						<path d="M9 6V4h6v2" />
					</svg>
				</button>
			{:else}
				<span class="app-title">MyLife</span>
			{/if}
		</div>
```

- [ ] **Step 2: Add mobile header icon styles to the `<style>` block**

Inside the `@media (max-width: 768px)` block, after the existing `.hamburger` styles, add:

```css
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
			color: var(--green);
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
```

- [ ] **Step 3: Check Catppuccin green token name**

```bash
grep -n "green" src/app.css | head -10
```

If the token is named differently (e.g. `--color-green`, `--success`), update `var(--green)` in the style added above to match.

- [ ] **Step 4: Run validate**

```bash
npm run validate
```

Expected: no errors. The mobile header now shows folder name + icons on mobile.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: unified mobile header with folder name and icon buttons"
```

---

## Task 5: Update and extend E2E mobile tests

The existing test at line 122 of `tests/e2e/mobile-layout.spec.ts` checks `getByRole('heading', { name: 'inbox' })`. The `<h2>` in `.panel-header` is now hidden on mobile; the folder name is a `<span role="heading" aria-level="2">` in the mobile header — which Playwright's `getByRole('heading')` still matches. That test should pass unchanged.

Add new tests for the mobile rename and delete flows.

**Files:**
- Modify: `tests/e2e/mobile-layout.spec.ts`

- [ ] **Step 1: Run existing E2E tests first to confirm they still pass**

```bash
npm run test:e2e -- --grep "mobile layout"
```

Expected: all 4 existing mobile layout tests pass.

- [ ] **Step 2: Add mobile rename and delete tests**

Append the following inside the `test.describe('mobile layout', ...)` block, after the last existing test:

```typescript
	test('mobile header shows folder name when folder is selected', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		// Folder name appears in header bar (not "MyLife")
		const heading = page.getByRole('heading', { name: 'journal' });
		await expect(heading).toBeVisible();
		await expect(page.locator('.app-title').filter({ hasText: 'MyLife' })).not.toBeVisible();
	});

	test('mobile header shows rename and delete icon buttons when folder is selected', async ({
		page
	}) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
	});

	test('tapping rename icon shows inline input in mobile header', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Rename' }).click();

		// Rename input appears in header with current folder name pre-filled
		const input = page.locator('.mobile-rename-input');
		await expect(input).toBeVisible();
		await expect(input).toHaveValue('journal');

		// Confirm and cancel icons appear
		await expect(page.getByRole('button', { name: 'Confirm rename' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel rename' })).toBeVisible();
	});

	test('confirming rename updates the folder name in mobile header', async ({ page }) => {
		await page.route('https://api.github.com/**', (route) => {
			const method = route.request().method();
			const url = route.request().url();

			if (url.includes('/git/trees/main')) {
				return route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						tree: [{ path: 'journal/.gitkeep', type: 'blob', sha: 'sha1' }]
					})
				});
			}
			if (method === 'PUT' || method === 'DELETE' || method === 'GET') {
				return route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ content: { sha: 'new-sha' } })
				});
			}
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});

		await page.goto('/');
		await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
		await page.fill('input[type="password"]', 'fake-token');
		await page.fill('input[type="text"]', REPO);
		await page.getByRole('button', { name: /connect/i }).click();
		await page.waitForURL('/', { timeout: 10_000 });

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Rename' }).click();

		const input = page.locator('.mobile-rename-input');
		await input.fill('diary');
		await input.press('Enter');

		// Header shows new name
		await expect(page.getByRole('heading', { name: 'diary' })).toBeVisible();
	});

	test('tapping delete icon shows confirm bar', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Delete' }).click();

		// Confirm bar appears below header
		await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

		// Folder name still visible in header (not icons)
		await expect(page.getByRole('heading', { name: 'journal' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Rename' })).not.toBeVisible();
	});
```

- [ ] **Step 3: Run all E2E mobile tests**

```bash
npm run test:e2e -- --grep "mobile layout"
```

Expected: all tests pass.

- [ ] **Step 4: Run full validate**

```bash
npm run validate
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/mobile-layout.spec.ts
git commit -m "test: add E2E tests for mobile header rename and delete flows"
```

---

## Self-Review

**Spec coverage:**
- [x] No folder selected → "MyLife" in header — covered in Task 4 template (`{:else}` branch) and Task 5 test
- [x] Folder selected → folder name + pencil + trash — covered in Tasks 3–4
- [x] Rename inline in header → input + checkmark + X — covered in Task 4
- [x] Rename state lifts to +page.svelte — covered in Task 3
- [x] FolderPanel `.panel-header` hidden on mobile — covered in Task 2 (`display: none` in media query)
- [x] `.confirm-bar` stays visible on mobile — FolderPanel confirm-bar has no `display: none` override; stays visible
- [x] Desktop unchanged — `.panel-header` only hidden via `@media (max-width: 768px)`
- [x] Integration tests updated — Task 1–2
- [x] E2E tests added — Task 5

**No placeholders:** All steps have complete code.

**Type consistency:** `onconfirmrename` (no args) used consistently — confirmRename reads `renameName` from closure rather than passing the value through the callback.
