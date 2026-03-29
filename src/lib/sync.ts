import type { GitHubClient } from './github';
import type { NoteCache } from './cache';
import type { Note, SyncQueueItem } from './types';

function titleFromContent(content: string, path: string): string {
	const firstLine = content.split('\n')[0]?.trim();
	if (firstLine) return firstLine.replace(/^#\s*/, '');
	const filename = path.split('/').pop() ?? path;
	return filename.replace(/\.md$/, '');
}

function detectType(content: string): 'text' | 'todo' {
	return content.includes('- [ ]') || content.includes('- [x]') ? 'todo' : 'text';
}

export class SyncEngine {
	constructor(
		private github: GitHubClient,
		private cache: NoteCache
	) {}

	async fullSync(): Promise<Note[]> {
		const files = await this.github.listFiles();
		const mdFiles = files.filter((f) => f.path.endsWith('.md'));
		const notes: Note[] = [];

		for (const file of mdFiles) {
			const { content, sha } = await this.github.getFileContent(file.path);
			const note: Note = {
				path: file.path,
				title: titleFromContent(content, file.path),
				content,
				type: detectType(content),
				pinned: false,
				updatedAt: new Date().toISOString(),
				sha
			};
			await this.cache.saveNote(note);
			notes.push(note);
		}

		return notes;
	}

	async pushOfflineQueue(): Promise<void> {
		const queue = await this.cache.getSyncQueue();
		if (queue.length === 0) return;

		const remaining: SyncQueueItem[] = [];

		for (const item of queue) {
			try {
				switch (item.action) {
					case 'create':
						await this.github.createFile(item.path, item.content ?? '');
						break;
					case 'update':
						await this.github.updateFile(item.path, item.content ?? '', item.sha ?? '');
						break;
					case 'delete':
						await this.github.deleteFile(item.path, item.sha ?? '');
						break;
				}
			} catch {
				remaining.push(item);
			}
		}

		await this.cache.saveSyncQueue(remaining);
	}
}
