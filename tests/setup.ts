import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';

// In-memory localStorage mock — Node 25 has a native localStorage but it
// requires --localstorage-file to be set and lacks clear(). Provide a full
// in-memory implementation so tests can use localStorage.clear() freely.
const localStorageStore = new Map<string, string>();
const localStorageMock: Storage = {
	get length() {
		return localStorageStore.size;
	},
	clear() {
		localStorageStore.clear();
	},
	getItem(key: string) {
		return localStorageStore.get(key) ?? null;
	},
	setItem(key: string, value: string) {
		localStorageStore.set(key, value);
	},
	removeItem(key: string) {
		localStorageStore.delete(key);
	},
	key(index: number) {
		return [...localStorageStore.keys()][index] ?? null;
	}
};
vi.stubGlobal('localStorage', localStorageMock);

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

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Reset stores between tests
beforeEach(() => {
	store.clear();
	localStorageStore.clear();
});

// Export for tests that need direct store access
export { store };
