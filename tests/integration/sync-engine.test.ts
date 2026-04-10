import { describe, it, expect, beforeEach } from 'vitest';
import { SyncEngine } from '$lib/sync';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse, createTestSyncItem } from '../factories';

// Mock only the network boundary
const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

describe('SyncEngine', () => {
	let github: GitHubClient;
	let cache: NoteCache; // REAL cache, backed by in-memory idb-keyval
	let sync: SyncEngine;

	beforeEach(() => {
		mockFetch.mockReset();
		github = new GitHubClient('fake-token', 'testuser/mylife-notes');
		cache = new NoteCache();
		sync = new SyncEngine(github, cache);
	});

	describe('fullSync', () => {
		it('includes .gitkeep files so empty folders survive a refresh', async () => {
			mockFetch.mockResolvedValueOnce(
				githubResponse({
					tree: [{ path: 'projects/.gitkeep', type: 'blob', sha: 'gk1' }]
				})
			);
			mockFetch.mockResolvedValueOnce(githubResponse({ content: btoa(''), sha: 'gk1' }));

			const notes = await sync.fullSync();

			expect(notes).toHaveLength(1);
			expect(notes[0].path).toBe('projects/.gitkeep');
		});

		it('fetches files from GitHub, caches them, and returns Notes', async () => {
			// Mock: listFiles (tree endpoint)
			mockFetch.mockResolvedValueOnce(
				githubResponse({
					tree: [
						{ path: 'inbox/note.md', type: 'blob', sha: 'abc' },
						{ path: 'inbox', type: 'tree', sha: 'dir' }
					]
				})
			);
			// Mock: getFileContent
			mockFetch.mockResolvedValueOnce(githubResponse({ content: btoa('Hello world'), sha: 'abc' }));

			const notes = await sync.fullSync();

			expect(notes).toHaveLength(1);
			expect(notes[0].path).toBe('inbox/note.md');
			expect(notes[0].content).toBe('Hello world');
			expect(notes[0].title).toBe('Hello world');

			// Verify it was cached (real IndexedDB)
			const cached = await cache.getNote('inbox/note.md');
			expect(cached?.content).toBe('Hello world');
		});

		it('derives title from # heading', async () => {
			mockFetch.mockResolvedValueOnce(
				githubResponse({ tree: [{ path: 'work/task.md', type: 'blob', sha: 'x' }] })
			);
			mockFetch.mockResolvedValueOnce(
				githubResponse({ content: btoa('# My Task\nSome details'), sha: 'x' })
			);

			const notes = await sync.fullSync();
			expect(notes[0].title).toBe('My Task');
		});

		it('detects todo type from checkbox syntax', async () => {
			mockFetch.mockResolvedValueOnce(
				githubResponse({ tree: [{ path: 'inbox/todos.md', type: 'blob', sha: 'y' }] })
			);
			mockFetch.mockResolvedValueOnce(
				githubResponse({ content: btoa('Shopping\n- [ ] Milk\n- [x] Eggs'), sha: 'y' })
			);

			const notes = await sync.fullSync();
			expect(notes[0].type).toBe('todo');
		});
	});

	describe('pushOfflineQueue', () => {
		it('processes queued create operations and clears the queue', async () => {
			// Seed the queue in real cache
			await cache.saveSyncQueue([
				createTestSyncItem({ action: 'create', path: 'inbox/new.md', content: 'New note' })
			]);
			mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

			await sync.pushOfflineQueue();

			// Verify GitHub was called
			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(mockFetch.mock.calls[0][0]).toContain('/contents/inbox/new.md');

			// Verify queue was cleared
			const queue = await cache.getSyncQueue();
			expect(queue).toEqual([]);
		});

		it('keeps failed items in queue for retry', async () => {
			await cache.saveSyncQueue([
				createTestSyncItem({ action: 'create', path: 'inbox/ok.md', content: 'ok' }),
				createTestSyncItem({ action: 'create', path: 'inbox/fail.md', content: 'fail' })
			]);
			mockFetch
				.mockResolvedValueOnce(githubResponse({ content: { sha: 'sha1' } }))
				.mockRejectedValueOnce(new Error('network error'));

			await sync.pushOfflineQueue();

			const queue = await cache.getSyncQueue();
			expect(queue).toHaveLength(1);
			expect(queue[0].path).toBe('inbox/fail.md');
		});

		it('processes queued update operations', async () => {
			await cache.saveSyncQueue([
				createTestSyncItem({
					action: 'update',
					path: 'inbox/note.md',
					content: 'updated',
					sha: 'old-sha'
				})
			]);
			mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

			await sync.pushOfflineQueue();

			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toContain('/contents/inbox/note.md');
			expect(opts.method).toBe('PUT');
			expect(JSON.parse(opts.body).sha).toBe('old-sha');
			expect(await cache.getSyncQueue()).toEqual([]);
		});

		it('processes queued delete operations', async () => {
			await cache.saveSyncQueue([
				createTestSyncItem({ action: 'delete', path: 'inbox/gone.md', sha: 'del-sha' })
			]);
			mockFetch.mockResolvedValueOnce(githubResponse({}));

			await sync.pushOfflineQueue();

			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toContain('/contents/inbox/gone.md');
			expect(opts.method).toBe('DELETE');
			expect(await cache.getSyncQueue()).toEqual([]);
		});

		it('does nothing when queue is empty', async () => {
			await sync.pushOfflineQueue();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});
});
