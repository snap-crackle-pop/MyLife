import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Sidebar from '$lib/components/Sidebar.svelte';

// ── Theme store ───────────────────────────────────────────────────────────────

type UiStore = typeof import('$lib/stores/ui.svelte');
let ui: UiStore;

describe('theme store', () => {
	beforeEach(async () => {
		localStorage.clear();
		vi.resetModules();
		ui = await import('$lib/stores/ui.svelte');
	});

	it('defaults to dark when localStorage is empty', () => {
		expect(ui.getTheme()).toBe('dark');
	});

	it('toggleTheme switches dark → light', () => {
		ui.toggleTheme();
		expect(ui.getTheme()).toBe('light');
	});

	it('toggleTheme switches light → dark', () => {
		ui.toggleTheme(); // dark → light
		ui.toggleTheme(); // light → dark
		expect(ui.getTheme()).toBe('dark');
	});

	it('persists theme to localStorage on toggle', () => {
		ui.toggleTheme();
		expect(localStorage.getItem('theme')).toBe('light');
	});

	it('reads saved theme from localStorage on init', async () => {
		localStorage.setItem('theme', 'light');
		vi.resetModules();
		const freshUi = await import('$lib/stores/ui.svelte');
		expect(freshUi.getTheme()).toBe('light');
	});
});

// ── Sidebar toggle button ─────────────────────────────────────────────────────
// TODO(Task 4): Sidebar component not yet updated — unskip when toggle button is added

describe.skip('Sidebar theme toggle', () => {
	it('shows Switch to light mode button when theme is dark', () => {
		render(Sidebar, {
			props: { folders: [], selectedFolder: null, theme: 'dark' }
		});
		expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
	});

	it('shows Switch to dark mode button when theme is light', () => {
		render(Sidebar, {
			props: { folders: [], selectedFolder: null, theme: 'light' }
		});
		expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
	});

	it('calls ontoggletheme when toggle button is clicked', async () => {
		const ontoggletheme = vi.fn();
		render(Sidebar, {
			props: { folders: [], selectedFolder: null, theme: 'dark', ontoggletheme }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
		expect(ontoggletheme).toHaveBeenCalledOnce();
	});
});
