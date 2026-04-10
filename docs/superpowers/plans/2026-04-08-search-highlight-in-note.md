# Search Highlight in Note — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a search result is clicked in the sidebar, the textarea in FolderPanel scrolls to and selects the first occurrence of the search query; pressing Escape or typing clears the selection.

**Architecture:** Add a `searchHighlight` string to `ui.svelte.ts`. Sidebar writes it when a result is clicked (and clears it when search is cancelled). FolderPanel reads it in a `$effect`, calls `textarea.setSelectionRange()` and scrolls. Keyboard and input handlers clear it.

**Tech Stack:** Svelte 5 runes (`$state`, `$effect`), `HTMLTextAreaElement.setSelectionRange()`, `@testing-library/svelte`, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/stores/ui.svelte.ts` | Add `searchHighlight` `$state` + `getSearchHighlight` / `setSearchHighlight` exports |
| `src/lib/components/Sidebar.svelte` | Import `setSearchHighlight`; call it on result click and in `clearSearch()` |
| `src/lib/components/FolderPanel.svelte` | Import `getSearchHighlight` + `setSearchHighlight`; add `$effect` + keydown/input handlers on textarea |
| `tests/integration/search-highlight.test.ts` | New test file covering all three tasks |

---

### Task 1: Add searchHighlight to ui.svelte.ts

**Files:**
- Modify: `src/lib/stores/ui.svelte.ts`
- Create: `tests/integration/search-highlight.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/search-highlight.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createTestNote } from '../factories';
import type { Note } from '$lib/types';

// ── Module reset helpers ───────────────────────────────────────────────────────
// ui.svelte.ts uses module-level $state; vi.resetModules() gives fresh state.
// Sidebar and FolderPanel import from ui.svelte.ts so they must be re-imported too.

type UiModule = typeof import('$lib/stores/ui.svelte');

let ui: UiModule;
let Sidebar: (typeof import('$lib/components/Sidebar.svelte'))['default'];
let FolderPanel: (typeof import('$lib/components/FolderPanel.svelte'))['default'];

beforeEach(async () => {
	vi.resetModules();
	vi.stubGlobal('SpeechRecognition', vi.fn(() => ({
		start: vi.fn(),
		stop: vi.fn(),
		onresult: null,
		onerror: null,
		onend: null,
		interimResults: false,
		continuous: false
	})));
	ui = await import('$lib/stores/ui.svelte');
	Sidebar = (await import('$lib/components/Sidebar.svelte')).default;
	FolderPanel = (await import('$lib/components/FolderPanel.svelte')).default;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Task 1: Store ─────────────────────────────────────────────────────────────

describe('searchHighlight store', () => {
	it('returns empty string by default', () => {
		expect(ui.getSearchHighlight()).toBe('');
	});

	it('setSearchHighlight updates the value', () => {
		ui.setSearchHighlight('hello');
		expect(ui.getSearchHighlight()).toBe('hello');
	});

	it('setSearchHighlight clears the value when called with empty string', () => {
		ui.setSearchHighlight('hello');
		ui.setSearchHighlight('');
		expect(ui.getSearchHighlight()).toBe('');
	});
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run tests/integration/search-highlight.test.ts
```

Expected: FAIL — `ui.getSearchHighlight is not a function`

- [ ] **Step 3: Add searchHighlight to ui.svelte.ts**

Open `src/lib/stores/ui.svelte.ts` and append after the existing exports:

```ts
let searchHighlight = $state('');

export function getSearchHighlight() {
	return searchHighlight;
}

export function setSearchHighlight(query: string) {
	searchHighlight = query;
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npx vitest run tests/integration/search-highlight.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/ui.svelte.ts tests/integration/search-highlight.test.ts
git commit -m "feat: add searchHighlight state to ui store"
```

---

### Task 2: Sidebar calls setSearchHighlight on result click

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`
- Modify: `tests/integration/search-highlight.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/integration/search-highlight.test.ts` (inside the file, after the existing describe block):

```ts
// ── Task 2: Sidebar wires store ───────────────────────────────────────────────

const searchNotes: Note[] = [
	createTestNote({ path: 'journal/index.md', content: 'This is my daily journal with foo here' }),
	createTestNote({ path: 'recipes/index.md', content: 'My recipe: chocolate cake with foo on top' })
];

describe('Sidebar sets searchHighlight on result click', () => {
	it('sets searchHighlight to the query when a search result is clicked', async () => {
		render(Sidebar, {
			props: { folders: [], selectedFolder: null, notes: searchNotes }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'foo' }
		});
		const result = document.querySelector('[data-folder="journal"]') as HTMLElement;
		await fireEvent.click(result);
		expect(ui.getSearchHighlight()).toBe('foo');
	});

	it('clears searchHighlight when clearSearch is triggered via Escape', async () => {
		ui.setSearchHighlight('foo');
		render(Sidebar, {
			props: { folders: [], selectedFolder: null, notes: searchNotes }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.keyDown(screen.getByPlaceholderText('Search notes…'), { key: 'Escape' });
		expect(ui.getSearchHighlight()).toBe('');
	});
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run tests/integration/search-highlight.test.ts
```

Expected: FAIL — `getSearchHighlight()` returns `''` after clicking (store not updated yet)

- [ ] **Step 3: Wire Sidebar to the store**

Open `src/lib/components/Sidebar.svelte`. In the `<script>` block, add the import after the existing imports:

```ts
import { setSearchHighlight } from '$lib/stores/ui.svelte';
```

Find the `clearSearch` function and add the store call:

```ts
function clearSearch() {
	searchMode = false;
	searchQuery = '';
	selectedSearchFolder = null;
	setSearchHighlight('');
}
```

Find the search result button's `onclick` handler (the one that calls `onselectfolder`). It currently reads:

```ts
onclick={() => {
	selectedSearchFolder = result.folderPath;
	onselectfolder?.(result.folderPath);
}}
```

Change it to:

```ts
onclick={() => {
	setSearchHighlight(rawQuery);
	selectedSearchFolder = result.folderPath;
	onselectfolder?.(result.folderPath);
}}
```

The `rawQuery` variable is already defined at the top of `searchResults` derived block as:
```ts
const rawQuery = searchQuery.trim();
```
It is in scope for the template since `searchResults` is a `$derived.by` — but `rawQuery` is local to that block, not available in the template.

Instead, read it from `searchQuery` directly in the onclick:

```ts
onclick={() => {
	setSearchHighlight(searchQuery.trim());
	selectedSearchFolder = result.folderPath;
	onselectfolder?.(result.folderPath);
}}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npx vitest run tests/integration/search-highlight.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Validate and commit**

```bash
npm run validate
git add src/lib/components/Sidebar.svelte tests/integration/search-highlight.test.ts
git commit -m "feat: sidebar sets searchHighlight on result click"
```

---

### Task 3: FolderPanel applies highlight from store

**Files:**
- Modify: `src/lib/components/FolderPanel.svelte`
- Modify: `tests/integration/search-highlight.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/integration/search-highlight.test.ts`:

```ts
// ── Task 3: FolderPanel applies selection ─────────────────────────────────────

function renderPanel(content: string) {
	const note = createTestNote({ content });
	render(FolderPanel, {
		props: { folder: 'inbox', note, renaming: false, renameName: '', confirming: false }
	});
	return note;
}

function getTextarea() {
	return screen.getByPlaceholderText('Start writing...') as HTMLTextAreaElement;
}

describe('FolderPanel search highlight', () => {
	it('selects the first match in the textarea when searchHighlight is set', async () => {
		renderPanel('Hello world, test query here');
		ui.setSearchHighlight('test');
		await tick();
		const textarea = getTextarea();
		// 'Hello world, ' = 13 chars; 'test' = 4 chars → selectionStart=13, selectionEnd=17
		expect(textarea.selectionStart).toBe(13);
		expect(textarea.selectionEnd).toBe(17);
	});

	it('is case-insensitive when matching', async () => {
		renderPanel('Hello world, TEST query here');
		ui.setSearchHighlight('test');
		await tick();
		const textarea = getTextarea();
		expect(textarea.selectionStart).toBe(13);
		expect(textarea.selectionEnd).toBe(17);
	});

	it('does nothing if the query is not found in the note content', async () => {
		renderPanel('Hello world, no match here');
		ui.setSearchHighlight('xyznotexist');
		await tick();
		const textarea = getTextarea();
		// Selection stays at 0 (default for unfocused textarea)
		expect(textarea.selectionStart).toBe(0);
		expect(textarea.selectionEnd).toBe(0);
	});

	it('clears searchHighlight when user types in the textarea', async () => {
		renderPanel('Hello world, test query here');
		ui.setSearchHighlight('test');
		await tick();
		await fireEvent.input(getTextarea(), {
			target: { value: 'Hello world, test query here x' }
		});
		expect(ui.getSearchHighlight()).toBe('');
	});

	it('clears searchHighlight when Escape is pressed in the textarea', async () => {
		renderPanel('Hello world, test query here');
		ui.setSearchHighlight('test');
		await tick();
		await fireEvent.keyDown(getTextarea(), { key: 'Escape' });
		expect(ui.getSearchHighlight()).toBe('');
	});

	it('does not clear searchHighlight on Escape if it is already empty', async () => {
		renderPanel('Hello world, test query here');
		// No highlight set — just verify no error thrown
		await fireEvent.keyDown(getTextarea(), { key: 'Escape' });
		expect(ui.getSearchHighlight()).toBe('');
	});
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run tests/integration/search-highlight.test.ts
```

Expected: FAIL — selection stays at 0, highlight not cleared on input/Escape

- [ ] **Step 3: Implement in FolderPanel.svelte**

Open `src/lib/components/FolderPanel.svelte`. Add the import at the top of the `<script>` block, after the existing imports:

```ts
import { getSearchHighlight, setSearchHighlight } from '$lib/stores/ui.svelte';
```

After the existing `let textareaEl = $state<HTMLTextAreaElement | null>(null);` line, add the highlight effect:

```ts
$effect(() => {
	const highlight = getSearchHighlight();
	if (!highlight || !note || !textareaEl) return;
	const lower = note.content.toLowerCase();
	const idx = lower.indexOf(highlight.toLowerCase());
	if (idx === -1) return;
	textareaEl.focus();
	textareaEl.setSelectionRange(idx, idx + highlight.length);
	const lineHeight = parseFloat(getComputedStyle(textareaEl).lineHeight) || 20;
	const linesBefore = note.content.slice(0, idx).split('\n').length - 1;
	textareaEl.scrollTop = Math.max(0, linesBefore * lineHeight - textareaEl.clientHeight / 2);
});
```

Find the `<textarea>` element. It currently has:
```svelte
<textarea
	class="note-editor"
	value={...}
	oninput={handleInput}
	placeholder="Start writing..."
	bind:this={textareaEl}
></textarea>
```

Add `onkeydown` and update `oninput` to clear the highlight:

```svelte
<textarea
	class="note-editor"
	value={recognition.listening && recognition.interim
		? dictationBase
			? `${dictationBase} ${recognition.interim}`
			: recognition.interim
		: (note?.content ?? '')}
	oninput={(e) => {
		if (getSearchHighlight()) setSearchHighlight('');
		handleInput(e);
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape' && getSearchHighlight()) setSearchHighlight('');
	}}
	placeholder="Start writing..."
	bind:this={textareaEl}
></textarea>
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npx vitest run tests/integration/search-highlight.test.ts
```

Expected: PASS (11 tests)

- [ ] **Step 5: Validate and commit**

```bash
npm run validate
git add src/lib/components/FolderPanel.svelte tests/integration/search-highlight.test.ts
git commit -m "feat: highlight search query in note editor on folder select"
```
