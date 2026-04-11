import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { SyncEngine } from '$lib/sync';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { createTestSyncItem } from '../factories';

describe('SyncEngine', () => {
	let github: GitHubClient;
	let cache: NoteCache;
	let sync: SyncEngine;

	beforeEach(() => {
		github = new GitHubClient('fake-token', 'testuser/mylife-notes');
		cache = new NoteCache();
		sync = new SyncEngine(github, cache);
	});

	describe('fullSync', () => {
		it('includes .gitkeep files so empty folders survive a refresh', async () => {
			server.use(
				http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () =>
					HttpResponse.json({
						tree: [{ path: 'projects/.gitkeep', type: 'blob', sha: 'gk1' }]
					})
				),
				http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
					HttpResponse.json({ content: btoa(''), sha: 'gk1' })
				)
			);

			const notes = await sync.fullSync();

			expect(notes).toHaveLength(1);
			expect(notes[0].path).toBe('projects/.gitkeep');
		});

		it('fetches files from GitHub, caches them, and returns Notes', async () => {
			server.use(
				http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () =>
					HttpResponse.json({
						tree: [
							{ path: 'inbox/note.md', type: 'blob', sha: 'abc' },
							{ path: 'inbox', type: 'tree', sha: 'dir' }
						]
					})
				),
				http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
					HttpResponse.json({ content: btoa('Hello world'), sha: 'abc' })
				)
			);

			const notes = await sync.fullSync();

			expect(notes).toHaveLength(1);
			expect(notes[0].path).toBe('inbox/note.md');
			expect(notes[0].content).toBe('Hello world');
			expect(notes[0].title).toBe('Hello world');

			const cached = await cache.getNote('inbox/note.md');
			expect(cached?.content).toBe('Hello world');
		});

		it('derives title from # heading', async () => {
			server.use(
				http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () =>
					HttpResponse.json({ tree: [{ path: 'work/task.md', type: 'blob', sha: 'x' }] })
				),
				http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
					HttpResponse.json({ content: btoa('# My Task\nSome details'), sha: 'x' })
				)
			);

			const notes = await sync.fullSync();
			expect(notes[0].title).toBe('My Task');
		});

		it('detects todo type from checkbox syntax', async () => {
			server.use(
				http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () =>
					HttpResponse.json({ tree: [{ path: 'inbox/todos.md', type: 'blob', sha: 'y' }] })
				),
				http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
					HttpResponse.json({ content: btoa('Shopping\n- [ ] Milk\n- [x] Eggs'), sha: 'y' })
				)
			);

			const notes = await sync.fullSync();
			expect(notes[0].type).toBe('todo');
		});
	});

	describe('pushOfflineQueue', () => {
		it('processes queued create operations and clears the queue', async () => {
			await cache.saveSyncQueue([
				createTestSyncItem({ action: 'create', path: 'inbox/new.md', content: 'New note' })
			]);

			let capturedUrl = '';
			server.use(
				http.put('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json({ content: { sha: 'new-sha' } });
				})
			);

			await sync.pushOfflineQueue();

			expect(capturedUrl).toContain('/contents/inbox/new.md');

			const queue = await cache.getSyncQueue();
			expect(queue).toEqual([]);
		});

		it('keeps failed items in queue for retry', async () => {
			await cache.saveSyncQueue([
				createTestSyncItem({ action: 'create', path: 'inbox/ok.md', content: 'ok' }),
				createTestSyncItem({ action: 'create', path: 'inbox/fail.md', content: 'fail' })
			]);

			let callCount = 0;
			server.use(
				http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => {
					callCount++;
					if (callCount === 2) return HttpResponse.error();
					return HttpResponse.json({ content: { sha: `sha${callCount}` } });
				})
			);

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

			let capturedUrl = '';
			let capturedMethod = '';
			let capturedBody: { sha?: string } = {};
			server.use(
				http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
					capturedUrl = request.url;
					capturedMethod = request.method;
					capturedBody = (await request.json()) as { sha?: string };
					return HttpResponse.json({ content: { sha: 'new-sha' } });
				})
			);

			await sync.pushOfflineQueue();

			expect(capturedUrl).toContain('/contents/inbox/note.md');
			expect(capturedMethod).toBe('PUT');
			expect(capturedBody.sha).toBe('old-sha');
			expect(await cache.getSyncQueue()).toEqual([]);
		});

		it('processes queued delete operations', async () => {
			await cache.saveSyncQueue([
				createTestSyncItem({ action: 'delete', path: 'inbox/gone.md', sha: 'del-sha' })
			]);

			let capturedUrl = '';
			let capturedMethod = '';
			server.use(
				http.delete('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
					capturedUrl = request.url;
					capturedMethod = request.method;
					return HttpResponse.json({});
				})
			);

			await sync.pushOfflineQueue();

			expect(capturedUrl).toContain('/contents/inbox/gone.md');
			expect(capturedMethod).toBe('DELETE');
			expect(await cache.getSyncQueue()).toEqual([]);
		});

		it('does nothing when queue is empty', async () => {
			await sync.pushOfflineQueue();
			const queue = await cache.getSyncQueue();
			expect(queue).toEqual([]);
		});
	});
});
