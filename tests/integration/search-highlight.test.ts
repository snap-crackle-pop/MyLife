import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { Note } from '$lib/types';
import { createTestNote } from '../factories';
import Sidebar from '$lib/components/Sidebar.svelte';
import { setSearchHighlight, getSearchHighlight } from '$lib/stores/ui.svelte';

// ── Module reset helpers ───────────────────────────────────────────────────────
// ui.svelte.ts uses module-level $state; vi.resetModules() gives fresh state.

type UiModule = typeof import('$lib/stores/ui.svelte');

let ui: UiModule;

describe('searchHighlight store', () => {
	beforeEach(async () => {
		vi.resetModules();
		ui = await import('$lib/stores/ui.svelte');
	});

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

// ── Task 2: Sidebar wires store ───────────────────────────────────────────────

const searchNotes: Note[] = [
	createTestNote({ path: 'journal/index.md', content: 'This is my daily journal with foo here' }),
	createTestNote({ path: 'recipes/index.md', content: 'My recipe: chocolate cake with foo on top' })
];

describe('Sidebar sets searchHighlight on result click', () => {
	beforeEach(() => {
		// Clear searchHighlight state before each test (don't reset modules to avoid Svelte effect issues)
		setSearchHighlight('');
	});

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
		expect(getSearchHighlight()).toBe('foo');
	});

	it('clears searchHighlight when clearSearch is triggered via Escape', async () => {
		setSearchHighlight('foo');
		render(Sidebar, {
			props: { folders: [], selectedFolder: null, notes: searchNotes }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.keyDown(screen.getByPlaceholderText('Search notes…'), { key: 'Escape' });
		expect(getSearchHighlight()).toBe('');
	});
});
