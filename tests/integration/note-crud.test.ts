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

// ── createNote ────────────────────────────────────────────────────────────────

describe('createNote', () => {
	it('adds note to store immediately before API responds', async () => {
		await store.createNote('inbox', 'My First Note', 'text');

		const notes = store.getNotes();
		expect(notes.some((n) => n.title === 'My First Note')).toBe(true);
	});

	it('patches SHA in store and cache after API succeeds', async () => {
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'confirmed-sha' } })
			)
		);

		const note = await store.createNote('inbox', 'Confirmed Note', 'text');

		const inStore = store.getNotes().find((n) => n.path === note.path);
		expect(inStore?.sha).toBe('confirmed-sha');

		const cached = await testCache.getNote(note.path);
		expect(cached?.sha).toBe('confirmed-sha');
	});

	it('note stays in store and op is queued when API fails', async () => {
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.error())
		);

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

		const queue = await testCache.getSyncQueue();
		expect(queue.length).toBe(1);
		expect(queue[0].action).toBe('create');
	});

	it('creates a todo note with checkbox syntax', async () => {
		const note = await store.createNote('inbox', 'Shopping List', 'todo');

		expect(note.type).toBe('todo');
		expect(note.content).toContain('- [ ]');
	});
});

// ── updateNote ────────────────────────────────────────────────────────────────

describe('updateNote', () => {
	it('updates note content in store immediately', async () => {
		const note = await store.createNote('inbox', 'Draft Note', 'text');

		await store.updateNote(note.path, 'Updated content');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.content).toBe('Updated content');
	});

	it('derives title from first line of new content', async () => {
		const note = await store.createNote('inbox', 'Old Title', 'text');

		await store.updateNote(note.path, '# New Title\n\nBody text here');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.title).toBe('New Title');
	});

	it('detects todo type when content has checkboxes', async () => {
		const note = await store.createNote('inbox', 'Plain Note', 'text');

		await store.updateNote(note.path, 'Tasks\n\n- [ ] First item\n- [x] Done');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.type).toBe('todo');
	});

	it('patches SHA in store after API succeeds', async () => {
		const note = await store.createNote('inbox', 'SHA Test', 'text');

		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'updated-sha' } })
			)
		);
		await store.updateNote(note.path, 'New content');

		const updated = store.getNotes().find((n) => n.path === note.path);
		expect(updated?.sha).toBe('updated-sha');
	});

	it('queues update op when API fails', async () => {
		const note = await store.createNote('inbox', 'Will Fail Note', 'text');

		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.error())
		);
		await store.updateNote(note.path, 'Updated but failed');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'update' && q.path === note.path)).toBe(true);
	});
});

// ── deleteNote ────────────────────────────────────────────────────────────────

describe('deleteNote', () => {
	it('removes note from store and cache immediately', async () => {
		const note = await store.createNote('inbox', 'To Delete', 'text');

		await store.deleteNote(note.path);

		const notes = store.getNotes();
		expect(notes.some((n) => n.path === note.path)).toBe(false);
		expect(notes.some((n) => n.path.startsWith('.trash/'))).toBe(false);
	});

	it('calls deleteFile with the correct path and sha', async () => {
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'sha-del' } })
			)
		);
		const note = await store.createNote('inbox', 'Del SHA Test', 'text');

		let capturedUrl = '';
		let capturedMethod = '';
		let capturedBody: { sha?: string } = {};
		server.use(
			http.delete('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
				capturedUrl = request.url;
				capturedMethod = request.method;
				capturedBody = (await request.json()) as { sha?: string };
				return HttpResponse.json({});
			})
		);

		await store.deleteNote(note.path);

		expect(capturedUrl).toContain('inbox');
		expect(capturedMethod.toUpperCase()).toBe('DELETE');
		expect(capturedBody.sha).toBe('sha-del');
	});

	it('queues delete op when API fails', async () => {
		const note = await store.createNote('inbox', 'Fail Delete', 'text');

		server.use(
			http.delete('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.error()
			)
		);

		await store.deleteNote(note.path);

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'delete' && q.path === note.path)).toBe(true);
	});

	it('queues delete op and skips API when offline', async () => {
		const note = await store.createNote('inbox', 'Offline Delete', 'text');

		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.deleteNote(note.path);

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.action === 'delete' && q.path === note.path)).toBe(true);
	});
});
