import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { createTestNote } from '../factories';

describe('GitHub API Client', () => {
	let client: GitHubClient;

	beforeEach(() => {
		client = new GitHubClient('fake-token', 'testuser/mylife-notes');
	});

	it('lists files from repo tree, filtering to blobs only', async () => {
		let capturedUrl = '';
		server.use(
			http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', ({ request }) => {
				capturedUrl = request.url;
				return HttpResponse.json({
					tree: [
						{ path: 'inbox/note1.md', type: 'blob', sha: 'abc123' },
						{ path: 'inbox', type: 'tree', sha: 'def456' },
						{ path: 'work/task.md', type: 'blob', sha: 'ghi789' }
					]
				});
			})
		);

		const files = await client.listFiles();

		expect(files).toEqual([
			{ path: 'inbox/note1.md', sha: 'abc123' },
			{ path: 'work/task.md', sha: 'ghi789' }
		]);
		expect(capturedUrl).toContain('/git/trees/main?recursive=1');
	});

	it('fetches and decodes base64 file content', async () => {
		server.use(
			http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: btoa('Hello world'), sha: 'abc123' })
			)
		);

		const result = await client.getFileContent('inbox/note1.md');
		expect(result).toEqual({ content: 'Hello world', sha: 'abc123' });
	});

	it('creates a file and returns new sha', async () => {
		let capturedUrl = '';
		let capturedMethod = '';
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
				capturedUrl = request.url;
				capturedMethod = request.method;
				return HttpResponse.json({ content: { sha: 'new-sha' } });
			})
		);

		const sha = await client.createFile('inbox/new.md', 'Note content');

		expect(sha).toBe('new-sha');
		expect(capturedUrl).toContain('/contents/inbox/new.md');
		expect(capturedMethod).toBe('PUT');
	});

	it('updates a file with existing sha', async () => {
		let capturedBody: { sha?: string } = {};
		server.use(
			http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ request }) => {
				capturedBody = (await request.json()) as { sha?: string };
				return HttpResponse.json({ content: { sha: 'updated-sha' } });
			})
		);

		const sha = await client.updateFile('inbox/note.md', 'Updated', 'old-sha');

		expect(sha).toBe('updated-sha');
		expect(capturedBody.sha).toBe('old-sha');
	});

	it('deletes a file', async () => {
		let capturedMethod = '';
		server.use(
			http.delete('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
				capturedMethod = request.method;
				return HttpResponse.json({});
			})
		);

		await client.deleteFile('inbox/old.md', 'abc123');

		expect(capturedMethod).toBe('DELETE');
	});

	it('returns empty array for 404 (empty repo with no commits)', async () => {
		server.use(
			http.get(
				'https://api.github.com/repos/:owner/:repo/git/trees/:sha',
				() => new HttpResponse(null, { status: 404, statusText: 'Not Found' })
			)
		);

		const files = await client.listFiles();
		expect(files).toEqual([]);
	});

	it('throws on non-404 API errors', async () => {
		server.use(
			http.get(
				'https://api.github.com/repos/:owner/:repo/git/trees/:sha',
				() => new HttpResponse(null, { status: 401, statusText: 'Unauthorized' })
			)
		);

		await expect(client.listFiles()).rejects.toThrow('GitHub API error: 401 Unauthorized');
	});
});

describe('GitHub Client + IndexedDB Cache integration', () => {
	let client: GitHubClient;
	let cache: NoteCache;

	beforeEach(() => {
		client = new GitHubClient('fake-token', 'testuser/mylife-notes');
		cache = new NoteCache();
	});

	it('fetches a file from GitHub and caches it locally', async () => {
		server.use(
			http.get('https://api.github.com/repos/:owner/:repo/contents/*', () =>
				HttpResponse.json({ content: btoa('My note content'), sha: 'file-sha' })
			)
		);

		const { content, sha } = await client.getFileContent('inbox/test.md');
		const note = createTestNote({ path: 'inbox/test.md', content, sha });
		await cache.saveNote(note);

		const cached = await cache.getNote('inbox/test.md');
		expect(cached?.content).toBe('My note content');
		expect(cached?.sha).toBe('file-sha');
	});

	it('cache persists multiple notes and lists them', async () => {
		const note1 = createTestNote({ path: 'inbox/a.md' });
		const note2 = createTestNote({ path: 'work/b.md' });

		await cache.saveNote(note1);
		await cache.saveNote(note2);

		const all = await cache.getAllNotes();
		expect(all).toHaveLength(2);
		expect(all.map((n) => n.path)).toContain('inbox/a.md');
		expect(all.map((n) => n.path)).toContain('work/b.md');
	});

	it('cache deletes a note', async () => {
		const note = createTestNote({ path: 'inbox/del.md' });
		await cache.saveNote(note);
		await cache.deleteNote('inbox/del.md');

		const result = await cache.getNote('inbox/del.md');
		expect(result).toBeUndefined();
	});

	it('cache saves and retrieves app config', async () => {
		await cache.saveConfig({ token: 'ghp_test', repo: 'user/repo' });
		const config = await cache.getConfig();
		expect(config).toEqual({ token: 'ghp_test', repo: 'user/repo' });
	});

	it('cache saves and retrieves sync queue', async () => {
		const queue = [
			{
				action: 'create' as const,
				path: 'inbox/new.md',
				content: 'hi',
				queuedAt: new Date().toISOString()
			}
		];
		await cache.saveSyncQueue(queue);
		const retrieved = await cache.getSyncQueue();
		expect(retrieved).toEqual(queue);
	});
});
