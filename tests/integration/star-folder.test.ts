import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse } from '../factories';
import { store as idbStore } from '../setup';

const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

const testCache = new NoteCache();

type StoreModule = typeof import('$lib/stores/notes.svelte');
let store: StoreModule;

beforeEach(async () => {
	mockFetch.mockReset();
	vi.resetModules();
	store = (await import('$lib/stores/notes.svelte')) as StoreModule;
	store.initStore('fake-token', 'testuser/mylife-notes');
	Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
});

afterEach(() => {
	Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
});

describe('toggleStarFolder', () => {
	it('adds a folder to the starred list immediately', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'star-sha' } }));

		await store.toggleStarFolder('inbox');

		expect(store.getStarredFolders()).toContain('inbox');
		expect(store.isStarredFolder('inbox')).toBe(true);
	});

	it('removes a folder when toggled a second time', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		await store.toggleStarFolder('inbox');
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));
		await store.toggleStarFolder('inbox');

		expect(store.getStarredFolders()).not.toContain('inbox');
		expect(store.isStarredFolder('inbox')).toBe(false);
	});

	it('calls createFile for _stars.json on first star (no existing SHA)', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

		await store.toggleStarFolder('work');

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/contents/_stars.json'),
			expect.objectContaining({ method: 'PUT' })
		);
		// No sha in body means create (not update)
		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.sha).toBeUndefined();
	});

	it('writes the correct JSON array to _stars.json', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));

		await store.toggleStarFolder('inbox');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		const content = atob(body.content);
		expect(JSON.parse(content)).toEqual(['inbox']);
	});

	it('calls updateFile (includes sha in body) after first star sets SHA', async () => {
		// First toggle — creates file, returns SHA
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'first-sha' } }));
		await store.toggleStarFolder('inbox');
		mockFetch.mockReset();

		// Second toggle on a different folder — should update with the known SHA
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'second-sha' } }));
		await store.toggleStarFolder('work');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.sha).toBe('first-sha');
	});

	it('patches starsSha after GitHub responds', async () => {
		// First toggle — creates, returns first-sha
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'first-sha' } }));
		await store.toggleStarFolder('inbox');
		mockFetch.mockReset();

		// Second toggle — updates using first-sha, returns second-sha
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'second-sha' } }));
		await store.toggleStarFolder('work');
		mockFetch.mockReset();

		// Third toggle — should now use second-sha (the patched value)
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'third-sha' } }));
		await store.toggleStarFolder('archive');

		const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
		expect(body.sha).toBe('second-sha');
	});

	it('saves starred folders to IndexedDB cache', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));

		await store.toggleStarFolder('inbox');

		const cached = idbStore.get('starred-folders') as { paths: string[]; sha: string };
		expect(cached.paths).toContain('inbox');
	});

	it('queues a create op when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.toggleStarFolder('inbox');

		expect(mockFetch).not.toHaveBeenCalled();
		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === '_stars.json' && q.action === 'create')).toBe(true);
	});

	it('queues an op when the API call fails', async () => {
		mockFetch.mockRejectedValueOnce(new Error('network error'));

		await store.toggleStarFolder('inbox');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === '_stars.json')).toBe(true);
	});
});

describe('starred folder cleanup', () => {
	it('removes deleted folder from starredFolders', async () => {
		// Setup: create folder, star it
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'idx-sha' } })); // createFolder
		await store.createFolder('inbox');
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'star-sha' } })); // toggleStarFolder
		await store.toggleStarFolder('inbox');
		expect(store.isStarredFolder('inbox')).toBe(true);
		mockFetch.mockReset();

		// Delete folder — mock deleteFile + _stars.json update
		mockFetch.mockResolvedValueOnce(githubResponse({})); // deleteFile
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'stars-updated' } })); // update _stars.json

		await store.deleteFolder('inbox');

		expect(store.isStarredFolder('inbox')).toBe(false);
		expect(store.getStarredFolders()).not.toContain('inbox');
	});

	it('updates starred path when folder is renamed', async () => {
		// Setup: create folder, star it
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'idx-sha' } })); // createFolder
		await store.createFolder('work');
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'star-sha' } })); // toggleStarFolder
		await store.toggleStarFolder('work');
		expect(store.isStarredFolder('work')).toBe(true);
		mockFetch.mockReset();

		// Rename folder — mock create new + delete old + _stars.json update
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } })) // create new index.md
			.mockResolvedValueOnce(githubResponse({})) // delete old index.md
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'stars-updated' } })); // update _stars.json

		await store.renameFolder('work', 'projects');

		expect(store.isStarredFolder('work')).toBe(false);
		expect(store.isStarredFolder('projects')).toBe(true);
	});
});

describe('loadNotes — star bootstrap', () => {
	it('loads starred folders from cache when offline', async () => {
		idbStore.set('starred-folders', { paths: ['cached-inbox'], sha: 'sha-from-cache' });
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.loadNotes();

		expect(store.isStarredFolder('cached-inbox')).toBe(true);
	});

	it('fetches stars from GitHub and updates cache when online', async () => {
		// pushOfflineQueue reads cache (no fetch if queue empty)
		// fullSync: listFiles returns empty tree (no .md files to fetch)
		mockFetch.mockResolvedValueOnce(githubResponse({ tree: [] }));
		// getFileContent('_stars.json')
		mockFetch.mockResolvedValueOnce(
			githubResponse({ content: btoa(JSON.stringify(['remote-folder'])), sha: 'remote-sha' })
		);

		await store.loadNotes();

		expect(store.isStarredFolder('remote-folder')).toBe(true);
		const cached = idbStore.get('starred-folders') as { paths: string[]; sha: string };
		expect(cached.sha).toBe('remote-sha');
	});
});
