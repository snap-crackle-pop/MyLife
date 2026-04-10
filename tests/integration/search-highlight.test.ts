import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Module reset helpers ───────────────────────────────────────────────────────
// ui.svelte.ts uses module-level $state; vi.resetModules() gives fresh state.

type UiModule = typeof import('$lib/stores/ui.svelte');

let ui: UiModule;

describe('searchHighlight store', () => {
	beforeEach(async () => {
		localStorage.clear();
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
