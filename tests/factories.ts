import type { Note, Folder, SyncQueueItem, AppConfig } from '$lib/types';

let noteCounter = 0;

export function createTestNote(overrides: Partial<Note> = {}): Note {
	noteCounter++;
	return {
		path: `inbox/note-${noteCounter}.md`,
		title: `Test Note ${noteCounter}`,
		content: `Content of note ${noteCounter}`,
		type: 'text',
		pinned: false,
		updatedAt: new Date().toISOString(),
		sha: `sha-${noteCounter}`,
		...overrides
	};
}

export function createTestTodo(overrides: Partial<Note> = {}): Note {
	return createTestNote({
		type: 'todo',
		content: `Todo List\n\n- [ ] First task\n- [ ] Second task\n- [x] Done task`,
		...overrides
	});
}

export function createTestFolder(overrides: Partial<Folder> = {}): Folder {
	return {
		path: 'inbox',
		name: 'inbox',
		children: [],
		...overrides
	};
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
	return {
		token: 'ghp_test-token-123',
		repo: 'testuser/mylife-notes',
		...overrides
	};
}

export function createTestSyncItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
	return {
		action: 'create',
		path: 'inbox/new.md',
		content: 'New note content',
		queuedAt: new Date().toISOString(),
		...overrides
	};
}

/**
 * Creates a mock fetch that responds to GitHub API calls.
 * Use this instead of manually crafting mockFetch responses.
 */
export function createMockFetch() {
	return vi.fn();
}

/**
 * Helper to create a successful GitHub API response.
 */
export function githubResponse(data: unknown) {
	return {
		ok: true,
		json: async () => data
	};
}

/**
 * Helper to create a failed GitHub API response.
 */
export function githubError(status: number, statusText: string) {
	return {
		ok: false,
		status,
		statusText
	};
}
