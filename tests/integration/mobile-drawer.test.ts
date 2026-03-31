import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Sidebar from '$lib/components/Sidebar.svelte';

// ── Viewport store ────────────────────────────────────────────────────────────

describe('viewport store', () => {
	let fireResize: () => void;

	beforeEach(() => {
		vi.resetModules();
		Object.defineProperty(window, 'innerHeight', {
			value: 844,
			configurable: true,
			writable: true
		});
		Object.defineProperty(window, 'visualViewport', {
			configurable: true,
			value: {
				height: 844,
				addEventListener(_: string, cb: () => void) {
					fireResize = cb;
				},
				removeEventListener: vi.fn()
			}
		});
	});

	it('returns 0 when keyboard is closed', async () => {
		const { getKeyboardOffset } = await import('$lib/stores/viewport.svelte');
		expect(getKeyboardOffset()).toBe(0);
	});

	it('returns keyboard height when keyboard opens', async () => {
		const { getKeyboardOffset } = await import('$lib/stores/viewport.svelte');
		// Simulate 300px keyboard opening (viewport shrinks from 844 → 544)
		Object.defineProperty(window.visualViewport!, 'height', {
			value: 544,
			configurable: true
		});
		fireResize();
		expect(getKeyboardOffset()).toBe(300);
	});

	it('returns 0 again when keyboard closes', async () => {
		const { getKeyboardOffset } = await import('$lib/stores/viewport.svelte');
		Object.defineProperty(window.visualViewport!, 'height', {
			value: 544,
			configurable: true
		});
		fireResize();
		Object.defineProperty(window.visualViewport!, 'height', {
			value: 844,
			configurable: true
		});
		fireResize();
		expect(getKeyboardOffset()).toBe(0);
	});
});

// ── Sidebar drawer props ───────────────────────────────────────────────────

describe('Sidebar drawer props', () => {
	it('shows a close button when onclose prop is provided', async () => {
		render(Sidebar, {
			props: {
				folders: [{ path: 'inbox', name: 'inbox', children: [] }],
				selectedFolder: null,
				isOpen: true,
				onclose: vi.fn()
			}
		});
		expect(screen.getByRole('button', { name: 'Close folders' })).toBeInTheDocument();
	});

	it('calls onclose when close button is clicked', async () => {
		const onclose = vi.fn();
		render(Sidebar, {
			props: {
				folders: [],
				selectedFolder: null,
				isOpen: true,
				onclose
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Close folders' }));
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('adds open class to nav when isOpen is true', async () => {
		render(Sidebar, {
			props: {
				folders: [],
				selectedFolder: null,
				isOpen: true
			}
		});
		expect(screen.getByRole('navigation')).toHaveClass('open');
	});

	it('does not add open class when isOpen is false', async () => {
		render(Sidebar, {
			props: {
				folders: [],
				selectedFolder: null,
				isOpen: false
			}
		});
		expect(screen.getByRole('navigation')).not.toHaveClass('open');
	});
});
