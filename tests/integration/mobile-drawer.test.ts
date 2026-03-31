import { describe, it, expect, beforeEach, vi } from 'vitest';

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
