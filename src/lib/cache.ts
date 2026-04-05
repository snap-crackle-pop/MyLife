import { get, set, del, keys } from 'idb-keyval';
import type { Note, SyncQueueItem } from './types';

const NOTE_PREFIX = 'note:';
const SYNC_QUEUE_KEY = 'sync-queue';
const CONFIG_KEY = 'app-config';
const STARRED_KEY = 'starred-folders';

export class NoteCache {
	async saveNote(note: Note): Promise<void> {
		await set(`${NOTE_PREFIX}${note.path}`, note);
	}

	async getNote(path: string): Promise<Note | undefined> {
		return get<Note>(`${NOTE_PREFIX}${path}`);
	}

	async getAllNotes(): Promise<Note[]> {
		const allKeys = await keys();
		const noteKeys = allKeys.filter((k) => String(k).startsWith(NOTE_PREFIX));
		const notes: Note[] = [];
		for (const key of noteKeys) {
			const note = await get<Note>(key);
			if (note) notes.push(note);
		}
		return notes;
	}

	async deleteNote(path: string): Promise<void> {
		await del(`${NOTE_PREFIX}${path}`);
	}

	async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
		await set(SYNC_QUEUE_KEY, queue);
	}

	async getSyncQueue(): Promise<SyncQueueItem[]> {
		return (await get<SyncQueueItem[]>(SYNC_QUEUE_KEY)) ?? [];
	}

	async saveConfig(config: { token: string; repo: string }): Promise<void> {
		await set(CONFIG_KEY, config);
	}

	async getConfig(): Promise<{ token: string; repo: string } | undefined> {
		return get(CONFIG_KEY);
	}

	async saveStarredFolders(data: { paths: string[]; sha: string }): Promise<void> {
		await set(STARRED_KEY, data);
	}

	async getStarredFolders(): Promise<{ paths: string[]; sha: string } | undefined> {
		return get<{ paths: string[]; sha: string }>(STARRED_KEY);
	}
}
