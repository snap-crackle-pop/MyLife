import '@testing-library/jest-dom/vitest';

// In-memory mock for idb-keyval — used by ALL tests.
// This gives us a real key-value store without needing IndexedDB in jsdom.
const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
	get: vi.fn((key: string) => Promise.resolve(store.get(key))),
	set: vi.fn((key: string, value: unknown) => {
		store.set(key, value);
		return Promise.resolve();
	}),
	del: vi.fn((key: string) => {
		store.delete(key);
		return Promise.resolve();
	}),
	keys: vi.fn(() => Promise.resolve([...store.keys()]))
}));

// Reset store between tests
beforeEach(() => {
	store.clear();
});

// Export for tests that need direct store access
export { store };
