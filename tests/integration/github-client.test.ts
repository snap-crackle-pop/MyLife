import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { createMockFetch, githubResponse, githubError, createTestNote } from '../factories';

// Only mock the network boundary — fetch. Everything else is real.
const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

describe('GitHub API Client', () => {
	let client: GitHubClient;

	beforeEach(() => {
		client = new GitHubClient('fake-token', 'testuser/mylife-notes');
		mockFetch.mockReset();
	});

	it('lists files from repo tree, filtering to blobs only', async () => {
		mockFetch.mockResolvedValueOnce(
			githubResponse({
				tree: [
					{ path: 'inbox/note1.md', type: 'blob', sha: 'abc123' },
					{ path: 'inbox', type: 'tree', sha: 'def456' },
					{ path: 'work/task.md', type: 'blob', sha: 'ghi789' }
				]
			})
		);

		const files = await client.listFiles();

		expect(files).toEqual([
			{ path: 'inbox/note1.md', sha: 'abc123' },
			{ path: 'work/task.md', sha: 'ghi789' }
		]);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('/git/trees/main?recursive=1'),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer fake-token' })
			})
		);
	});

	it('fetches and decodes base64 file content', async () => {
		mockFetch.mockResolvedValueOnce(
			githubResponse({
				content: btoa('Hello world'),
				sha: 'abc123'
			})
		);

		const result = await client.getFileContent('inbox/note1.md');
		expect(result).toEqual({ content: 'Hello world', sha: 'abc123' });
	});

	it('creates a file and returns new sha', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'new-sha' } }));

		const sha = await client.createFile('inbox/new.md', 'Note content');

		expect(sha).toBe('new-sha');
		const [url, opts] = mockFetch.mock.calls[0];
		expect(url).toContain('/contents/inbox/new.md');
		expect(opts.method).toBe('PUT');
	});

	it('updates a file with existing sha', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'updated-sha' } }));

		const sha = await client.updateFile('inbox/note.md', 'Updated', 'old-sha');

		expect(sha).toBe('updated-sha');
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.sha).toBe('old-sha');
	});

	it('deletes a file', async () => {
		mockFetch.mockResolvedValueOnce(githubResponse({}));

		await client.deleteFile('inbox/old.md', 'abc123');

		expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
	});

	it('returns empty array for 404 (empty repo with no commits)', async () => {
		mockFetch.mockResolvedValueOnce(githubError(404, 'Not Found'));

		const files = await client.listFiles();
		expect(files).toEqual([]);
	});

	it('throws on non-404 API errors', async () => {
		mockFetch.mockResolvedValueOnce(githubError(401, 'Unauthorized'));

		await expect(client.listFiles()).rejects.toThrow('GitHub API error: 401 Unauthorized');
	});
});

describe('GitHub Client + IndexedDB Cache integration', () => {
	let client: GitHubClient;
	let cache: NoteCache;

	beforeEach(() => {
		client = new GitHubClient('fake-token', 'testuser/mylife-notes');
		cache = new NoteCache();
		mockFetch.mockReset();
	});

	it('fetches a file from GitHub and caches it locally', async () => {
		mockFetch.mockResolvedValueOnce(
			githubResponse({
				content: btoa('My note content'),
				sha: 'file-sha'
			})
		);

		const { content, sha } = await client.getFileContent('inbox/test.md');
		const note = createTestNote({ path: 'inbox/test.md', content, sha });
		await cache.saveNote(note);

		// Verify round-trip through cache
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
