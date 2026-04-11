import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { NoteCache } from '$lib/cache';
import { store as idbStore } from '../setup';

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

describe('toggleStarFolder', () => {
	it('adds a folder to the starred list immediately', async () => {
		await store.toggleStarFolder('inbox');

		expect(store.getStarredFolders()).toContain('inbox');
		expect(store.isStarredFolder('inbox')).toBe(true);
	});

	it('removes a folder when toggled a second time', async () => {
		await store.toggleStarFolder('inbox');
		await store.toggleStarFolder('inbox');

		expect(store.getStarredFolders()).not.toContain('inbox');
		expect(store.isStarredFolder('inbox')).toBe(false);
	});

	it('calls createFile for _stars.json on first star (no existing SHA)', async () => {
		let capturedUrl = '';
		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
				capturedUrl = request.url;
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({ content: { sha: 'new-sha' } });
			})
		);

		await store.toggleStarFolder('work');

		expect(capturedUrl).toContain('/contents/_stars.json');
		expect(capturedBody.sha).toBeUndefined();
	});

	it('writes the correct JSON array to _stars.json', async () => {
		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({ content: { sha: 'sha-1' } });
			})
		);

		await store.toggleStarFolder('inbox');

		const content = atob(capturedBody.content as string);
		expect(JSON.parse(content)).toEqual(['inbox']);
	});

	it('calls updateFile (includes sha in body) after first star sets SHA', async () => {
		// First toggle — creates file, returns first-sha
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'first-sha' } })
			)
		);
		await store.toggleStarFolder('inbox');

		// Second toggle — should update with the known SHA
		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({ content: { sha: 'second-sha' } });
			})
		);
		await store.toggleStarFolder('work');

		expect(capturedBody.sha).toBe('first-sha');
	});

	it('patches starsSha after GitHub responds', async () => {
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'first-sha' } })
			)
		);
		await store.toggleStarFolder('inbox');

		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: { sha: 'second-sha' } })
			)
		);
		await store.toggleStarFolder('work');

		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({ content: { sha: 'third-sha' } });
			})
		);
		await store.toggleStarFolder('archive');

		expect(capturedBody.sha).toBe('second-sha');
	});

	it('saves starred folders to IndexedDB cache', async () => {
		await store.toggleStarFolder('inbox');

		const cached = idbStore.get('starred-folders') as { paths: string[]; sha: string };
		expect(cached.paths).toContain('inbox');
	});

	it('queues a create op when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

		await store.toggleStarFolder('inbox');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === '_stars.json' && q.action === 'create')).toBe(true);
	});

	it('queues an op when the API call fails', async () => {
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.error())
		);

		await store.toggleStarFolder('inbox');

		const queue = await testCache.getSyncQueue();
		expect(queue.some((q) => q.path === '_stars.json')).toBe(true);
	});
});

describe('starred folder cleanup', () => {
	it('removes deleted folder from starredFolders', async () => {
		await store.createFolder('inbox');
		await store.toggleStarFolder('inbox');
		expect(store.isStarredFolder('inbox')).toBe(true);

		await store.deleteFolder('inbox');

		expect(store.isStarredFolder('inbox')).toBe(false);
		expect(store.getStarredFolders()).not.toContain('inbox');
	});

	it('updates starred path when folder is renamed', async () => {
		await store.createFolder('work');
		await store.toggleStarFolder('work');
		expect(store.isStarredFolder('work')).toBe(true);

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
		server.use(
			http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () =>
				HttpResponse.json({ tree: [] })
			),
			http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({
					content: btoa(JSON.stringify(['remote-folder'])),
					sha: 'remote-sha'
				})
			)
		);

		await store.loadNotes();

		expect(store.isStarredFolder('remote-folder')).toBe(true);
		const cached = idbStore.get('starred-folders') as { paths: string[]; sha: string };
		expect(cached.sha).toBe('remote-sha');
	});
});
