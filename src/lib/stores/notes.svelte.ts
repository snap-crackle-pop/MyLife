import type { Note, Folder, SyncQueueItem } from '$lib/types';
import { GitHubClient } from '$lib/github';
import { NoteCache } from '$lib/cache';
import { SyncEngine } from '$lib/sync';

// --- Pure utility functions (exported for testing) ---

export function createSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

export function buildFolderTree(paths: string[]): Folder[] {
	const folderSet = new Map<string, Folder>();

	for (const path of paths) {
		const parts = path.split('/');
		for (let i = 0; i < parts.length - 1; i++) {
			const folderPath = parts.slice(0, i + 1).join('/');
			if (!folderSet.has(folderPath)) {
				folderSet.set(folderPath, {
					path: folderPath,
					name: parts[i],
					children: []
				});
			}
		}
	}

	const roots: Folder[] = [];
	for (const folder of folderSet.values()) {
		const parentPath = folder.path.split('/').slice(0, -1).join('/');
		const parent = folderSet.get(parentPath);
		if (parent) {
			if (!parent.children.find((c) => c.path === folder.path)) {
				parent.children.push(folder);
			}
		} else {
			roots.push(folder);
		}
	}

	return roots.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Reactive store ---

let notes = $state<Note[]>([]);
let loading = $state(false);
let initialized = $state(false);

let github: GitHubClient | null = null;
const cache = new NoteCache();
let sync: SyncEngine | null = null;

export function initStore(token: string, repo: string) {
	github = new GitHubClient(token, repo);
	sync = new SyncEngine(github, cache);
}

export function getNotes() {
	return notes;
}

export function isLoading() {
	return loading;
}

export function isInitialized() {
	return initialized;
}

export async function loadNotes() {
	loading = true;
	try {
		const cached = await cache.getAllNotes();
		if (cached.length > 0) {
			notes = cached;
			initialized = true;
		}

		if (navigator.onLine && sync) {
			await sync.pushOfflineQueue();
			const synced = await sync.fullSync();
			notes = synced;
		}

		initialized = true;
	} finally {
		loading = false;
	}
}

export async function createNote(
	folder: string,
	title: string,
	type: 'text' | 'todo'
): Promise<Note> {
	const slug = createSlug(title) || 'untitled';
	const path = `${folder}/${slug}.md`;
	const content = type === 'todo' ? `${title}\n\n- [ ] ` : title;
	const now = new Date().toISOString();

	const note: Note = {
		path,
		title,
		content,
		type,
		pinned: false,
		updatedAt: now,
		sha: ''
	};

	if (navigator.onLine && github) {
		note.sha = await github.createFile(path, content);
	} else {
		const queue = await cache.getSyncQueue();
		const item: SyncQueueItem = { action: 'create', path, content, queuedAt: now };
		queue.push(item);
		await cache.saveSyncQueue(queue);
	}

	await cache.saveNote(note);
	notes = [...notes, note];
	return note;
}

export async function updateNote(path: string, content: string) {
	const idx = notes.findIndex((n) => n.path === path);
	if (idx === -1) return;

	const existing = notes[idx];
	const now = new Date().toISOString();
	const updated: Note = {
		...existing,
		content,
		title: content.split('\n')[0]?.trim().replace(/^#\s*/, '') || existing.title,
		type: content.includes('- [ ]') || content.includes('- [x]') ? 'todo' : 'text',
		updatedAt: now
	};

	if (navigator.onLine && github) {
		updated.sha = await github.updateFile(path, content, existing.sha);
	} else {
		const queue = await cache.getSyncQueue();
		const item: SyncQueueItem = {
			action: 'update',
			path,
			content,
			sha: existing.sha,
			queuedAt: now
		};
		queue.push(item);
		await cache.saveSyncQueue(queue);
	}

	await cache.saveNote(updated);
	notes = notes.map((n) => (n.path === path ? updated : n));
}

export async function deleteNote(path: string) {
	const note = notes.find((n) => n.path === path);
	if (!note) return;

	const trashPath = `.trash/${path.split('/').pop()}`;
	const now = new Date().toISOString();

	if (navigator.onLine && github) {
		await github.createFile(trashPath, note.content);
		await github.deleteFile(path, note.sha);
	} else {
		const queue = await cache.getSyncQueue();
		queue.push({ action: 'create', path: trashPath, content: note.content, queuedAt: now });
		queue.push({ action: 'delete', path, sha: note.sha, queuedAt: now });
		await cache.saveSyncQueue(queue);
	}

	const trashedNote: Note = { ...note, path: trashPath, updatedAt: now };
	await cache.deleteNote(path);
	await cache.saveNote(trashedNote);
	notes = notes.filter((n) => n.path !== path);
	notes = [...notes, trashedNote];
}

export async function togglePin(path: string) {
	const note = notes.find((n) => n.path === path);
	if (!note) return;
	const updated = { ...note, pinned: !note.pinned };
	await cache.saveNote(updated);
	notes = notes.map((n) => (n.path === path ? updated : n));
}

export function getNotesInFolder(folder: string): Note[] {
	return notes.filter((n) => {
		const dir = n.path.substring(0, n.path.lastIndexOf('/'));
		return dir === folder;
	});
}

export function getPinnedNotes(): Note[] {
	return notes.filter((n) => n.pinned);
}

export function getFolderTree(): Folder[] {
	return buildFolderTree(notes.map((n) => n.path));
}
