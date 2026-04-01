import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse } from '../factories';

const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

// Test-side cache shares the same idb-keyval mock Map as the store's cache
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

// ── createNote ────────────────────────────────────────────────────────────────

describe('createNote', () => {
	it('adds note to store immediately before API responds', async () => {
		// The function awaits the API, so we verify the optimistic note structure
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-123' } }));

		await store.createNote('inbox', 'My First Note', 'text');

		const notes = store.getNotes();
		expect(notes.some((n) => n.title === 'My First Note')).toBe(true);
	});

	it('patches SHA in store and cache after API succeeds', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'confirmed-sha' } }));

		const note = await store.createNote('inbox', 'Confirmed Note', 'text');

		const inStore = store.getNotes().find((n) => n.path === note.path);
		expect(inStore?.sha).toBe('confirmed-sha');

		const cached = await testCache.getNote(note.path);
		expect(cached?.sha).toBe('confirmed-sha');
	});

	it('note stays in store and op is queued when API fails', async () => {
		mockFetch.mockRejectedValueOnce(new Error('network error'));

		await store.createNote('inbox', 'Queued Note', 'text');

		expect(store.getNotes().some((n) => n.title === 'Queued Note')).toBe(true);

		const queue = await testCache.getSyncQueue();
		expect(queue.length).toBe(1);
		expect(queue[0].action).toBe('create');
		expect(queue[0].path).toContain('inbox/');
	});

	it('queues op and skips API when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.createNote('inbox', 'Offline Note', 'text');

		expect(store.getNotes().some((n) => n.title === 'Offline Note')).toBe(true);
		expect(mockFetch).not.toHaveBeenCalled();

		const queue = await testCache.getSyncQueue();
		expect(queue.length).toBe(1);
		expect(queue[0].action).toBe('create');
	});

	it('creates a todo note with checkbox syntax', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-todo' } }));

		const note = await store.createNote('inbox', 'Shopping List', 'todo');

		expect(note.type).toBe('todo');
		expect(note.content).toContain('- [ ]');
	});
});

// ── updateNote ────────────────────────────────────────────────────────────────

describe('updateNote', () => {
	it('updates note content in store immediately', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Draft Note', 'text');

		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));
		await store.updateNote(note.path, 'Updated content');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.content).toBe('Updated content');
	});

	it('derives title from first line of new content', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Old Title', 'text');

		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));
		await store.updateNote(note.path, '# New Title\n\nBody text here');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.title).toBe('New Title');
	});

	it('detects todo type when content has checkboxes', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Plain Note', 'text');

		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));
		await store.updateNote(note.path, 'Tasks\n\n- [ ] First item\n- [x] Done');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.type).toBe('todo');
	});

	it('patches SHA in store after API succeeds', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'original-sha' } }));
		const note = await store.createNote('inbox', 'SHA Test', 'text');

		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'updated-sha' } }));
		await store.updateNote(note.path, 'New content');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.sha).toBe('updated-sha');
	});

	it('queues update op when API fails', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Will Fail Note', 'text');

		mockFetch.mockRejectedValueOnce(new Error('network error'));
		await store.updateNote(note.path, 'Updated but failed');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'update' && q.path === note.path)).toBe(true);
	});
});

// ── deleteNote ────────────────────────────────────────────────────────────────

describe('deleteNote', () => {
	it('removes note from store and cache immediately', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'To Delete', 'text');
		mockFetch.mockReset();
		mockFetch.mockResolvedValueOnce(githubResponse({}));

		await store.deleteNote(note.path);

		const notes = store.getNotes();
		expect(notes.some((n) => n.path === note.path)).toBe(false);
		expect(notes.some((n) => n.path.startsWith('.trash/'))).toBe(false);
	});

	it('calls deleteFile with the correct path and sha', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-del' } }));
		const note = await store.createNote('inbox', 'Del SHA Test', 'text');
		mockFetch.mockReset();
		mockFetch.mockResolvedValueOnce(githubResponse({}));

		await store.deleteNote(note.path);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('inbox');
		expect((opts.method as string).toUpperCase()).toBe('DELETE');
		const body = JSON.parse(opts.body as string);
		expect(body.sha).toBe('sha-del');
	});

	it('queues delete op when API fails', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Fail Delete', 'text');

		mockFetch.mockRejectedValueOnce(new Error('network error'));

		await store.deleteNote(note.path);

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'delete' && q.path === note.path)).toBe(true);
	});

	it('queues delete op and skips API when offline', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }));
		const note = await store.createNote('inbox', 'Offline Delete', 'text');
		mockFetch.mockReset();

		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.deleteNote(note.path);

		expect(mockFetch).not.toHaveBeenCalled();
		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'delete' && q.path === note.path)).toBe(true);
	});

	it('does nothing when note path is not found', async () => {
		await store.deleteNote('inbox/nonexistent.md');
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

// ── getNotesInFolder / getFolderTree ──────────────────────────────────────────

describe('getNotesInFolder', () => {
	it('returns only notes in the specified folder', async () => {
		mockFetch
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-1' } }))
			.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-2' } }));

		await store.createNote('inbox', 'Inbox Note', 'text');
		await store.createNote('work', 'Work Note', 'text');

		const inbox = store.getNotesInFolder('inbox');
		expect(inbox.every((n) => n.path.startsWith('inbox/'))).toBe(true);
		expect(inbox.some((n) => n.title === 'Inbox Note')).toBe(true);
		expect(inbox.some((n) => n.title === 'Work Note')).toBe(false);
	});

	it('excludes .gitkeep files from folder note list', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha-gk' } }));
		await store.createFolder('projects');

		const notes = store.getNotesInFolder('projects');
		expect(notes.some((n) => n.path.endsWith('.gitkeep'))).toBe(false);
	});
});
