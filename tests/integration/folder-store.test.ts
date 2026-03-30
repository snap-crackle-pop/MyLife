import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse } from '../factories';

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

// ── createFolder ──────────────────────────────────────────────────────────────

describe('createFolder', () => {
	it('adds .gitkeep placeholder to store immediately', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }));

		await store.createFolder('projects');

		const notes = store.getNotes();
		expect(notes.some((n) => n.path === 'projects/.gitkeep')).toBe(true);
	});

	it('folder appears in getFolderTree after creation', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }));

		await store.createFolder('reading');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'reading')).toBe(true);
	});

	it('patches .gitkeep SHA after API succeeds', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'real-sha' } }));

		await store.createFolder('ideas');

		const gk = store.getNotes().find((n) => n.path === 'ideas/.gitkeep');
		expect(gk?.sha).toBe('real-sha');
	});

	it('queues create op when API fails', async () => {
		mockFetch.mockRejectedValueOnce(new Error('server error'));
		// second call (getFileContent fallback) also fails
		mockFetch.mockRejectedValueOnce(new Error('not found'));

		await store.createFolder('drafts');

		expect(store.getNotes().some((n) => n.path === 'drafts/.gitkeep')).toBe(true);

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'create' && q.path === 'drafts/.gitkeep')).toBe(true);
	});

	it('queues op and skips API when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.createFolder('offline-folder');

		expect(mockFetch).not.toHaveBeenCalled();

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === 'offline-folder/.gitkeep')).toBe(true);
	});

	it('does not add duplicate .gitkeep if folder already exists', async () => {
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));

		await store.createFolder('dedupe');
		await store.createFolder('dedupe');

		const gkNotes = store.getNotes().filter((n) => n.path === 'dedupe/.gitkeep');
		expect(gkNotes.length).toBe(1);
	});
});

// ── renameFolder ──────────────────────────────────────────────────────────────

describe('renameFolder', () => {
	async function setupFolderWithNotes() {
		// Create folder + 2 notes
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } })) // createFolder
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-n1' } })) // note 1
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-n2' } })); // note 2

		await store.createFolder('work');
		await store.createNote('work', 'Task A', 'text');
		await store.createNote('work', 'Task B', 'text');
		mockFetch.mockReset();
	}

	it('renames all note paths in store immediately', async () => {
		await setupFolderWithNotes();

		// Mock API calls for each file: create new + delete old (3 files: .gitkeep + 2 notes)
		for (let i = 0; i < 3; i++) {
			mockFetch
				.mockResolvedValueOnce(githubResponse({ content: { sha: `new-sha-${i}` } })) // create new
				.mockResolvedValueOnce(githubResponse({})); // delete old
		}

		await store.renameFolder('work', 'projects');

		const notes = store.getNotes();
		expect(notes.every((n) => !n.path.startsWith('work/'))).toBe(true);
		expect(notes.filter((n) => n.path.startsWith('projects/')).length).toBe(3);
	});

	it('renamed folder appears in getFolderTree, old name does not', async () => {
		await setupFolderWithNotes();

		for (let i = 0; i < 3; i++) {
			mockFetch
				.mockResolvedValueOnce(githubResponse({ content: { sha: `sha-${i}` } }))
				.mockResolvedValueOnce(githubResponse({}));
		}

		await store.renameFolder('work', 'projects');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'projects')).toBe(true);
		expect(tree.some((f) => f.name === 'work')).toBe(false);
	});

	it('issues create+delete API calls for each file in the folder', async () => {
		await setupFolderWithNotes();

		for (let i = 0; i < 3; i++) {
			mockFetch
				.mockResolvedValueOnce(githubResponse({ content: { sha: `sha-${i}` } }))
				.mockResolvedValueOnce(githubResponse({}));
		}

		await store.renameFolder('work', 'archive');

		// 3 files × 2 calls (create + delete) = 6
		expect(mockFetch).toHaveBeenCalledTimes(6);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/contents/archive/'),
			expect.objectContaining({ method: 'PUT' })
		);
	});

	it('queues create+delete ops for files when API fails', async () => {
		await setupFolderWithNotes();
		mockFetch.mockRejectedValue(new Error('network error'));

		await store.renameFolder('work', 'archive');

		const queue = await testCache.getSyncQueue();
		const creates = queue.filter((q) => q.action === 'create' && q.path.startsWith('archive/'));
		const deletes = queue.filter((q) => q.action === 'delete' && q.path.startsWith('work/'));
		// Only note files queue deletes (.gitkeep with no sha skips delete)
		expect(creates.length).toBeGreaterThan(0);
		expect(deletes.length).toBeGreaterThan(0);
	});

	it('queues all ops when offline', async () => {
		await setupFolderWithNotes();
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.renameFolder('work', 'archive');

		expect(mockFetch).not.toHaveBeenCalled();

		const queue = await testCache.getSyncQueue();
		expect(queue.filter((q) => q.path.startsWith('archive/')).length).toBeGreaterThan(0);
	});
});

// ── deleteFolder ──────────────────────────────────────────────────────────────

describe('deleteFolder', () => {
	async function setupFolderWithNotes() {
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-n1' } }))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-n2' } }));

		await store.createFolder('old-folder');
		const n1 = await store.createNote('old-folder', 'Note One', 'text');
		const n2 = await store.createNote('old-folder', 'Note Two', 'text');
		mockFetch.mockReset();
		return { n1, n2 };
	}

	it('removes folder from store and getFolderTree immediately', async () => {
		await setupFolderWithNotes();

		mockFetch
			.mockResolvedValueOnce(githubResponse({})) // delete .gitkeep
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'trash-1' } })) // trash note 1
			.mockResolvedValueOnce(githubResponse({})) // delete note 1
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'trash-2' } })) // trash note 2
			.mockResolvedValueOnce(githubResponse({})); // delete note 2

		await store.deleteFolder('old-folder');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'old-folder')).toBe(false);
	});

	it('moves real notes to .trash/ in store, not .gitkeep', async () => {
		await setupFolderWithNotes();

		mockFetch
			.mockResolvedValueOnce(githubResponse({}))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'trash-1' } }))
			.mockResolvedValueOnce(githubResponse({}))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'trash-2' } }))
			.mockResolvedValueOnce(githubResponse({}));

		await store.deleteFolder('old-folder');

		const notes = store.getNotes();
		const trashed = notes.filter((n) => n.path.startsWith('.trash/'));
		expect(trashed.length).toBe(2);
		expect(notes.some((n) => n.path === 'old-folder/.gitkeep')).toBe(false);
	});

	it('patches trash SHA after API succeeds', async () => {
		await setupFolderWithNotes();

		mockFetch
			.mockResolvedValueOnce(githubResponse({})) // delete .gitkeep
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'trash-sha-confirmed' } }))
			.mockResolvedValueOnce(githubResponse({}))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'trash-sha-confirmed-2' } }))
			.mockResolvedValueOnce(githubResponse({}));

		await store.deleteFolder('old-folder');

		const trashed = store.getNotes().filter((n) => n.path.startsWith('.trash/'));
		expect(trashed.every((n) => n.sha.startsWith('trash-sha-confirmed'))).toBe(true);
	});

	it('queues create-trash and delete-original ops when API fails for notes', async () => {
		await setupFolderWithNotes();
		mockFetch.mockRejectedValue(new Error('network error'));

		await store.deleteFolder('old-folder');

		const queue = await testCache.getSyncQueue();
		const trashCreates = queue.filter((q) => q.action === 'create' && q.path.startsWith('.trash/'));
		const origDeletes = queue.filter(
			(q) => q.action === 'delete' && q.path.startsWith('old-folder/')
		);
		expect(trashCreates.length).toBe(2);
		expect(origDeletes.length).toBe(2);
	});

	it('handles deleting an empty folder (only .gitkeep)', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'gk-sha' } }));
		await store.createFolder('empty-folder');
		mockFetch.mockReset();

		mockFetch.mockResolvedValueOnce(githubResponse({})); // delete .gitkeep

		await store.deleteFolder('empty-folder');

		expect(store.getNotes().some((n) => n.path.startsWith('empty-folder/'))).toBe(false);
		const trashed = store.getNotes().filter((n) => n.path.startsWith('.trash/'));
		expect(trashed.length).toBe(0);
	});

	it('queues ops and skips API when offline', async () => {
		await setupFolderWithNotes();
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.deleteFolder('old-folder');

		expect(mockFetch).not.toHaveBeenCalled();

		const queue = await testCache.getSyncQueue();
		expect(queue.filter((q) => q.action === 'create' && q.path.startsWith('.trash/')).length).toBe(
			2
		);
	});
});
