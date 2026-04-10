import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { Note } from '$lib/types';
import { createTestNote } from '../factories';
import Sidebar from '$lib/components/Sidebar.svelte';
import FolderPanel from '$lib/components/FolderPanel.svelte';
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
	beforeEach(() => {
		setSearchHighlight('');
	});

	it('selects the first match in the textarea when searchHighlight is set', async () => {
		renderPanel('Hello world, test query here');
		setSearchHighlight('test');
		await tick();
		const textarea = getTextarea();
		// 'Hello world, ' = 13 chars; 'test' = 4 chars → selectionStart=13, selectionEnd=17
		expect(textarea.selectionStart).toBe(13);
		expect(textarea.selectionEnd).toBe(17);
	});

	it('is case-insensitive when matching', async () => {
		renderPanel('Hello world, TEST query here');
		setSearchHighlight('test');
		await tick();
		const textarea = getTextarea();
		expect(textarea.selectionStart).toBe(13);
		expect(textarea.selectionEnd).toBe(17);
	});

	it('does nothing if the query is not found in the note content', async () => {
		const content = 'Hello world, no match here';
		renderPanel(content);
		setSearchHighlight('xyznotexist');
		await tick();
		const textarea = getTextarea();
		// No selection is made — cursor stays at end (jsdom default after value is set)
		expect(textarea.selectionStart).toBe(textarea.selectionEnd);
		expect(textarea.selectionStart).toBe(content.length);
	});

	it('clears searchHighlight when user types in the textarea', async () => {
		renderPanel('Hello world, test query here');
		setSearchHighlight('test');
		await tick();
		await fireEvent.input(getTextarea(), {
			target: { value: 'Hello world, test query here x' }
		});
		expect(getSearchHighlight()).toBe('');
	});

	it('clears searchHighlight when Escape is pressed in the textarea', async () => {
		renderPanel('Hello world, test query here');
		setSearchHighlight('test');
		await tick();
		await fireEvent.keyDown(getTextarea(), { key: 'Escape' });
		expect(getSearchHighlight()).toBe('');
	});

	it('does not clear searchHighlight on Escape if it is already empty', async () => {
		renderPanel('Hello world, test query here');
		// No highlight set — just verify no error thrown
		await fireEvent.keyDown(getTextarea(), { key: 'Escape' });
		expect(getSearchHighlight()).toBe('');
	});
});
