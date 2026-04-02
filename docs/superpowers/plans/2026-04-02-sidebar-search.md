# Sidebar Folder Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a case-insensitive search input at the top of the folder sidebar that filters folders in real-time.

**Architecture:** All state and filtering live inside `Sidebar.svelte` — a `$state` search query, a `$derived.by` filtered list, and a search `<input>` rendered above the folder list. No prop changes, no store changes, no new components.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived.by`), `@testing-library/svelte` + Vitest for tests.

---

### Task 1: Write failing tests for sidebar search

**Files:**
- Create: `tests/integration/sidebar-search.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi } from 'vitest';
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
  children: [
    createTestFolder({ path: 'personal/journal', name: 'journal' })
  ]
});

const folders = [work, personal];

describe('Sidebar folder search', () => {
  it('shows all folders when search is empty', () => {
    render(Sidebar, { props: { folders, selectedFolder: null } });
    expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^personal$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^notes$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^archive$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^journal$/ })).toBeInTheDocument();
  });

  it('filters to matching top-level folder and hides its children', async () => {
    render(Sidebar, { props: { folders, selectedFolder: null } });
    await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
      target: { value: 'work' }
    });
    expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^notes$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^archive$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
  });

  it('shows parent as container with only matching children when parent does not match', async () => {
    render(Sidebar, { props: { folders, selectedFolder: null } });
    await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
      target: { value: 'notes' }
    });
    // Parent shown as container
    expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
    // Only matching child shown
    expect(screen.getByRole('button', { name: /^notes$/ })).toBeInTheDocument();
    // Non-matching child hidden
    expect(screen.queryByRole('button', { name: /^archive$/ })).not.toBeInTheDocument();
    // Unrelated folder hidden
    expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
  });

  it('shows empty list when nothing matches', async () => {
    render(Sidebar, { props: { folders, selectedFolder: null } });
    await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
      target: { value: 'zzz' }
    });
    expect(screen.queryByRole('button', { name: /^work$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
  });

  it('is case-insensitive', async () => {
    render(Sidebar, { props: { folders, selectedFolder: null } });
    await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
      target: { value: 'WORK' }
    });
    expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
  });

  it('resets search when sidebar closes', async () => {
    const onclose = vi.fn();
    render(Sidebar, { props: { folders, selectedFolder: null, isOpen: true, onclose } });
    await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
      target: { value: 'work' }
    });
    // personal is hidden
    expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Close folders' }));

    // After close, search is reset — all folders visible again
    expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^personal$/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --reporter=verbose tests/integration/sidebar-search.test.ts
```

Expected: all 6 tests FAIL — search input does not exist yet.

---

### Task 2: Implement sidebar search

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1: Add `searchQuery` state and `filteredFolders` derived value**

In the `<script>` block, after the existing `$state` declarations (after line 28), add:

```ts
let searchQuery = $state('');

let filteredFolders = $derived.by(() => {
  if (!searchQuery.trim()) return folders;
  const q = searchQuery.trim().toLowerCase();
  const result: Folder[] = [];
  for (const folder of folders) {
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
```

- [ ] **Step 2: Update `cancelAdd` → `onclose` handler to reset search**

Replace the existing `cancelAdd` function and update the close button handler. The `onclose` prop is already called by the close button's `onclick`. Wrap the call so it also resets `searchQuery`:

Replace:
```ts
function cancelAdd() {
  adding = false;
  newFolderName = '';
}
```

With:
```ts
function cancelAdd() {
  adding = false;
  newFolderName = '';
}

function handleClose() {
  searchQuery = '';
  onclose?.();
}
```

And update the close button in the template (around line 59):
```html
<button class="close-btn" onclick={handleClose} aria-label="Close folders">
```

- [ ] **Step 3: Add the search input to the template and change `#each` to use `filteredFolders`**

Replace the `<ul class="folder-list">` block's opening `{#each}` line so it iterates `filteredFolders` instead of `folders`. Also insert the search input between `.sidebar-header` and `.folder-list`.

The template section from `.sidebar-header` through to the start of `.folder-list` should look like:

```html
<div class="sidebar-header">
  <button class="close-btn" onclick={handleClose} aria-label="Close folders">
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
```

Leave the rest of the `<ul>` contents unchanged.

- [ ] **Step 4: Add CSS for the search input**

Inside the `<style>` block, add after the `.sidebar-header` rule:

```css
.search-wrap {
  padding: 6px 8px;
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
```

- [ ] **Step 5: Run the sidebar search tests to confirm they pass**

```bash
npm run test -- --reporter=verbose tests/integration/sidebar-search.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
npm run validate
```

Expected: all checks pass (type check, lint, format, tests).

---

### Task 3: Commit

- [ ] **Step 1: Commit**

```bash
git add src/lib/components/Sidebar.svelte tests/integration/sidebar-search.test.ts
git commit -m "feat: add case-insensitive search to folder sidebar"
```
