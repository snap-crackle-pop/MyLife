import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { NoteCache } from '$lib/cache';

const testCache = new NoteCache();

type StoreModule = typeof import('$lib/stores/notes.svelte');
let store: StoreModule;

beforeEach(async () => {
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
	it('adds index.md placeholder to store immediately', async () => {
		await store.createFolder('projects');

		const notes = store.getNotes();
		expect(notes.some((n) => n.path === 'projects/index.md')).toBe(true);
	});

	it('folder appears in getFolderTree after creation', async () => {
		await store.createFolder('reading');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'reading')).toBe(true);
	});

	it('patches index.md SHA after API succeeds', async () => {
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'real-sha' } })
			)
		);

		await store.createFolder('ideas');

		const gk = store.getNotes().find((n) => n.path === 'ideas/index.md');
		expect(gk?.sha).toBe('real-sha');
	});

	it('queues create op when API fails', async () => {
		// Both createFile (PUT) and the getFileContent fallback (GET) must fail
		// for the store to queue the op instead of using the fallback sha
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.error()),
			http.get('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.error())
		);

		await store.createFolder('drafts');

		expect(store.getNotes().some((n) => n.path === 'drafts/index.md')).toBe(true);

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'create' && q.path === 'drafts/index.md')).toBe(true);
	});

	it('queues op and skips API when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.createFolder('offline-folder');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === 'offline-folder/index.md')).toBe(true);
	});

	it('does not add duplicate index.md if folder already exists', async () => {
		await store.createFolder('dedupe');
		await store.createFolder('dedupe');

		const idxNotes = store.getNotes().filter((n) => n.path === 'dedupe/index.md');
		expect(idxNotes.length).toBe(1);
	});
});

// ── renameFolder ──────────────────────────────────────────────────────────────

describe('renameFolder', () => {
	async function setupFolderWithNotes() {
		// Default PUT handler covers all three creates (index.md + 2 notes)
		await store.createFolder('work');
		await store.createNote('work', 'Task A', 'text');
		await store.createNote('work', 'Task B', 'text');
	}

	it('renames all note paths in store immediately', async () => {
		await setupFolderWithNotes();

		await store.renameFolder('work', 'projects');

		const notes = store.getNotes();
		expect(notes.every((n) => !n.path.startsWith('work/'))).toBe(true);
		expect(notes.filter((n) => n.path.startsWith('projects/')).length).toBe(3);
	});

	it('renamed folder appears in getFolderTree, old name does not', async () => {
		await setupFolderWithNotes();

		await store.renameFolder('work', 'projects');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'projects')).toBe(true);
		expect(tree.some((f) => f.name === 'work')).toBe(false);
	});

	it('issues create+delete API calls for each file in the folder', async () => {
		await setupFolderWithNotes();

		const requestLog: { method: string; url: string }[] = [];
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
				requestLog.push({ method: 'PUT', url: request.url });
				return HttpResponse.json({ content: { sha: 'new-sha' } });
			}),
			http.delete('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
				requestLog.push({ method: 'DELETE', url: request.url });
				return HttpResponse.json({});
			})
		);

		await store.renameFolder('work', 'archive');

		expect(requestLog).toHaveLength(6); // 3 files × (create + delete)
		expect(requestLog.some((r) => r.method === 'PUT' && r.url.includes('/contents/archive/'))).toBe(
			true
		);
	});

	it('queues create+delete ops for files when API fails', async () => {
		await setupFolderWithNotes();
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.error()),
			http.delete('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.error()
			)
		);

		await store.renameFolder('work', 'archive');

		const queue = await testCache.getSyncQueue();
		const creates = queue.filter((q) => q.action === 'create' && q.path.startsWith('archive/'));
		const deletes = queue.filter((q) => q.action === 'delete' && q.path.startsWith('work/'));
		expect(creates.length).toBeGreaterThan(0);
		expect(deletes.length).toBeGreaterThan(0);
	});

	it('queues all ops when offline', async () => {
		await setupFolderWithNotes();
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.renameFolder('work', 'archive');

		const queue = await testCache.getSyncQueue();
		expect(queue.filter((q) => q.path.startsWith('archive/')).length).toBeGreaterThan(0);
	});
});

// ── deleteFolder ──────────────────────────────────────────────────────────────

describe('deleteFolder', () => {
	async function setupFolderWithNotes() {
		await store.createFolder('old-folder');
		const n1 = await store.createNote('old-folder', 'Note One', 'text');
		const n2 = await store.createNote('old-folder', 'Note Two', 'text');
		return { n1, n2 };
	}

	it('removes folder from store and getFolderTree immediately', async () => {
		await setupFolderWithNotes();

		await store.deleteFolder('old-folder');

		const tree = store.getFolderTree();
		expect(tree.some((f) => f.name === 'old-folder')).toBe(false);
	});

	it('permanently removes notes, not moves to .trash/', async () => {
		await setupFolderWithNotes();

		await store.deleteFolder('old-folder');

		const notes = store.getNotes();
		expect(notes.some((n) => n.path.startsWith('.trash/'))).toBe(false);
		expect(notes.some((n) => n.path.startsWith('old-folder/'))).toBe(false);
	});

	it('queues delete ops for each file when API fails', async () => {
		await setupFolderWithNotes();
		server.use(
			http.delete('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.error()
			)
		);

		await store.deleteFolder('old-folder');

		const queue = await testCache.getSyncQueue();
		const deletes = queue.filter((q) => q.action === 'delete' && q.path.startsWith('old-folder/'));
		expect(deletes.length).toBe(3); // index.md + 2 notes
	});

	it('handles deleting an empty folder (only index.md)', async () => {
		await store.createFolder('empty-folder');

		await store.deleteFolder('empty-folder');

		expect(store.getNotes().some((n) => n.path.startsWith('empty-folder/'))).toBe(false);
		expect(store.getNotes().some((n) => n.path.startsWith('.trash/'))).toBe(false);
	});

	it('queues delete ops and skips API when offline', async () => {
		await setupFolderWithNotes();
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.deleteFolder('old-folder');

		const queue = await testCache.getSyncQueue();
		expect(
			queue.filter((q) => q.action === 'delete' && q.path.startsWith('old-folder/')).length
		).toBe(3);
	});
});

// ── getFolderNote ─────────────────────────────────────────────────────────────

describe('getFolderNote', () => {
	it('returns the index.md note for a folder that exists', async () => {
		await store.createFolder('journal');

		const note = store.getFolderNote('journal');

		expect(note).not.toBeNull();
		expect(note?.path).toBe('journal/index.md');
	});

	it('returns null for a folder that has not been created', () => {
		expect(store.getFolderNote('nonexistent')).toBeNull();
	});

	it('returns the note after renaming the folder', async () => {
		await store.createFolder('old');

		await store.renameFolder('old', 'new');

		expect(store.getFolderNote('old')).toBeNull();
		expect(store.getFolderNote('new')?.path).toBe('new/index.md');
	});
});
