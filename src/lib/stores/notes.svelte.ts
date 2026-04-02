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

	return roots;
}

// --- Helpers ---

async function queueOp(item: SyncQueueItem) {
	const queue = await cache.getSyncQueue();
	queue.push(item);
	await cache.saveSyncQueue(queue);
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
			try {
				await sync.pushOfflineQueue();
				const synced = await sync.fullSync();
				notes = synced;
			} catch {
				// GitHub sync failed — keep showing cached notes
			}
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

	const note: Note = { path, title, content, type, pinned: false, updatedAt: now, sha: '' };

	// Optimistic: show immediately
	notes = [...notes, note];
	await cache.saveNote(note);

	if (navigator.onLine && github) {
		try {
			const sha = await github.createFile(path, content);
			const updated = { ...note, sha };
			notes = notes.map((n) => (n.path === path ? updated : n));
			await cache.saveNote(updated);
			return updated;
		} catch {
			await queueOp({ action: 'create', path, content, queuedAt: now });
		}
	} else {
		await queueOp({ action: 'create', path, content, queuedAt: now });
	}

	return note;
}

export async function updateNote(path: string, content: string) {
	const existing = notes.find((n) => n.path === path);
	if (!existing) return;

	const now = new Date().toISOString();
	const updated: Note = {
		...existing,
		content,
		title: content.split('\n')[0]?.trim().replace(/^#\s*/, '') || existing.title,
		type: content.includes('- [ ]') || content.includes('- [x]') ? 'todo' : 'text',
		updatedAt: now
	};

	// Optimistic: update immediately, keep existing sha until GitHub confirms
	notes = notes.map((n) => (n.path === path ? updated : n));
	await cache.saveNote(updated);

	if (navigator.onLine && github) {
		try {
			const sha = await github.updateFile(path, content, existing.sha);
			const withSha = { ...updated, sha };
			notes = notes.map((n) => (n.path === path ? withSha : n));
			await cache.saveNote(withSha);
		} catch {
			await queueOp({ action: 'update', path, content, sha: existing.sha, queuedAt: now });
		}
	} else {
		await queueOp({ action: 'update', path, content, sha: existing.sha, queuedAt: now });
	}
}

export async function deleteNote(path: string) {
	const note = notes.find((n) => n.path === path);
	if (!note) return;

	const now = new Date().toISOString();

	// Optimistic: remove immediately
	notes = notes.filter((n) => n.path !== path);
	await cache.deleteNote(path);

	if (navigator.onLine && github) {
		try {
			if (note.sha) await github.deleteFile(path, note.sha);
		} catch {
			if (note.sha) await queueOp({ action: 'delete', path, sha: note.sha, queuedAt: now });
		}
	} else {
		if (note.sha) await queueOp({ action: 'delete', path, sha: note.sha, queuedAt: now });
	}
}

export async function togglePin(path: string) {
	const note = notes.find((n) => n.path === path);
	if (!note) return;
	const updated = { ...note, pinned: !note.pinned };
	notes = notes.map((n) => (n.path === path ? updated : n));
	await cache.saveNote(updated);
}

export function getNotesInFolder(folder: string): Note[] {
	return notes.filter((n) => {
		const dir = n.path.substring(0, n.path.lastIndexOf('/'));
		return dir === folder && !n.path.endsWith('.gitkeep');
	});
}

export function getPinnedNotes(): Note[] {
	return notes.filter((n) => n.pinned);
}

export function getFolderNote(folder: string): Note | null {
	return notes.find((n) => n.path === `${folder}/index.md`) ?? null;
}

export function getFolderTree(): Folder[] {
	return buildFolderTree(notes.map((n) => n.path));
}

export async function createFolder(name: string): Promise<void> {
	const path = `${name}/index.md`;
	const now = new Date().toISOString();
	const note: Note = {
		path,
		title: 'index.md',
		content: '',
		type: 'text',
		pinned: false,
		updatedAt: now,
		sha: ''
	};

	// Optimistic: add to store and cache immediately
	if (!notes.find((n) => n.path === path)) {
		notes = [...notes, note];
		await cache.saveNote(note);
	}

	if (navigator.onLine && github) {
		let sha = '';
		try {
			sha = await github.createFile(path, '');
		} catch {
			try {
				const existing = await github.getFileContent(path);
				sha = existing.sha;
			} catch {
				await queueOp({ action: 'create', path, content: '', queuedAt: now });
			}
		}
		if (sha) {
			const updated = { ...note, sha };
			notes = notes.map((n) => (n.path === path ? updated : n));
			await cache.saveNote(updated);
		}
	} else {
		await queueOp({ action: 'create', path, content: '', queuedAt: now });
	}
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
	const toMove = notes.filter((n) => n.path.startsWith(`${oldName}/`));
	const now = new Date().toISOString();

	// Optimistic: rename all notes in store and cache immediately
	const renamed: Note[] = toMove.map((n) => ({
		...n,
		path: `${newName}/${n.path.slice(oldName.length + 1)}`,
		updatedAt: now
	}));

	for (let i = 0; i < toMove.length; i++) {
		await cache.deleteNote(toMove[i].path);
		await cache.saveNote(renamed[i]);
	}
	notes = [...notes.filter((n) => !n.path.startsWith(`${oldName}/`)), ...renamed];

	// Sync to GitHub — each file is independent
	for (let i = 0; i < toMove.length; i++) {
		const original = toMove[i];
		const newPath = renamed[i].path;

		if (navigator.onLine && github) {
			try {
				const sha = await github.createFile(newPath, original.content);
				if (original.sha) await github.deleteFile(original.path, original.sha);
				const updated = { ...renamed[i], sha };
				notes = notes.map((n) => (n.path === newPath ? updated : n));
				await cache.saveNote(updated);
			} catch {
				await queueOp({
					action: 'create',
					path: newPath,
					content: original.content,
					queuedAt: now
				});
				if (original.sha)
					await queueOp({
						action: 'delete',
						path: original.path,
						sha: original.sha,
						queuedAt: now
					});
			}
		} else {
			await queueOp({ action: 'create', path: newPath, content: original.content, queuedAt: now });
			if (original.sha)
				await queueOp({ action: 'delete', path: original.path, sha: original.sha, queuedAt: now });
		}
	}
}

export async function deleteFolder(name: string): Promise<void> {
	const toDelete = notes.filter((n) => n.path.startsWith(`${name}/`));
	const now = new Date().toISOString();

	// Optimistic: remove all notes in folder from store and cache immediately
	for (const note of toDelete) {
		await cache.deleteNote(note.path);
	}
	notes = notes.filter((n) => !n.path.startsWith(`${name}/`));

	// Sync to GitHub — each file is independent
	for (const note of toDelete) {
		if (navigator.onLine && github) {
			try {
				if (note.sha) await github.deleteFile(note.path, note.sha);
			} catch {
				if (note.sha)
					await queueOp({ action: 'delete', path: note.path, sha: note.sha, queuedAt: now });
			}
		} else {
			if (note.sha)
				await queueOp({ action: 'delete', path: note.path, sha: note.sha, queuedAt: now });
		}
	}
}
