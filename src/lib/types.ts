export interface Note {
	/** File path in GitHub repo, e.g. "inbox/my-note.md" */
	path: string;
	/** Display title (derived from first line or filename) */
	title: string;
	/** Full text content */
	content: string;
	/** Note type */
	type: 'text' | 'todo';
	/** Whether this note is pinned/favorited */
	pinned: boolean;
	/** ISO timestamp of last edit */
	updatedAt: string;
	/** GitHub file SHA (needed for updates via API) */
	sha: string;
}

export interface Folder {
	/** Folder path in repo, e.g. "work" */
	path: string;
	/** Display name */
	name: string;
	/** Child folders */
	children: Folder[];
}

export interface SyncQueueItem {
	/** Type of operation */
	action: 'create' | 'update' | 'delete';
	/** File path in repo */
	path: string;
	/** File content (for create/update) */
	content?: string;
	/** GitHub file SHA (for update/delete) */
	sha?: string;
	/** ISO timestamp when queued */
	queuedAt: string;
}

export interface AppConfig {
	/** GitHub Personal Access Token */
	token: string;
	/** GitHub repo in "owner/repo" format */
	repo: string;
}
