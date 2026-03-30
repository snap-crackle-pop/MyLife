<script lang="ts">
	import type { Note } from '$lib/types';

	interface Props {
		folder: string;
		notes: Note[];
		onrename?: (newName: string) => void;
		ondelete?: (folder: string) => void;
	}

	let { folder, notes, onrename, ondelete }: Props = $props();

	let renaming = $state(false);
	let renameName = $state('');
	let confirming = $state(false);

	function startRename() {
		renameName = folder.split('/').pop() ?? folder;
		renaming = true;
		confirming = false;
	}

	function confirmRename() {
		const name = renameName.trim();
		if (name && name !== folder) onrename?.(name);
		renaming = false;
	}

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmRename();
		if (e.key === 'Escape') {
			renaming = false;
		}
	}

	function startDelete() {
		confirming = true;
		renaming = false;
	}

	function confirmDelete() {
		ondelete?.(folder);
		confirming = false;
	}

	const realNotes = $derived(notes.filter((n) => !n.path.endsWith('.gitkeep')));
	const folderDisplayName = $derived(folder.split('/').pop() ?? folder);
</script>

<div class="panel">
	<header class="panel-header">
		{#if renaming}
			<input
				class="rename-input"
				value={renameName}
				oninput={(e) => (renameName = (e.target as HTMLInputElement).value)}
				onkeydown={handleRenameKey}
				onblur={() => (renaming = false)}
			/>
		{:else}
			<h2 class="folder-title">{folderDisplayName}</h2>
		{/if}

		<div class="actions">
			{#if !renaming && !confirming}
				<button class="action-btn" onclick={startRename} aria-label="Rename">Rename</button>
				<button class="action-btn danger" onclick={startDelete} aria-label="Delete">Delete</button>
			{/if}
		</div>
	</header>

	{#if confirming}
		<div class="confirm-bar">
			{#if realNotes.length > 0}
				<span class="confirm-msg">
					{realNotes.length}
					{realNotes.length === 1 ? 'note' : 'notes'} will be moved to trash. Delete
					<strong>{folderDisplayName}</strong>?
				</span>
			{:else}
				<span class="confirm-msg">Delete <strong>{folderDisplayName}</strong>?</span>
			{/if}
			<button class="action-btn danger" onclick={confirmDelete} aria-label="Confirm">Confirm</button
			>
			<button class="action-btn" onclick={() => (confirming = false)} aria-label="Cancel"
				>Cancel</button
			>
		</div>
	{/if}

	<div class="note-count">{realNotes.length} {realNotes.length === 1 ? 'note' : 'notes'}</div>

	{#if realNotes.length === 0}
		<p class="empty">No notes in this folder yet.</p>
	{:else}
		<ul class="note-list">
			{#each realNotes as note (note.path)}
				<li class="note-item">{note.title}</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.panel {
		flex: 1;
		height: 100%;
		background: var(--bg-surface);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px 12px;
		border-bottom: 1px solid var(--border);
		gap: 12px;
	}

	.folder-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.rename-input {
		font-size: 18px;
		font-weight: 600;
		padding: 2px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-base);
		flex: 1;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		font-size: 12px;
		padding: 4px 10px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		background: var(--bg-base);
		transition:
			border-color 0.1s,
			color 0.1s;
	}

	.action-btn:hover {
		border-color: var(--text-secondary);
		color: var(--text-primary);
	}

	.action-btn.danger {
		color: var(--danger);
		border-color: var(--danger);
	}

	.action-btn.danger:hover {
		background: var(--danger);
		color: var(--bg-base);
	}

	.confirm-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 24px;
		background: var(--bg-base);
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.confirm-msg {
		flex: 1;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.note-count {
		padding: 12px 24px 4px;
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-list {
		list-style: none;
		padding: 8px 16px;
		overflow-y: auto;
		flex: 1;
	}

	.note-item {
		padding: 8px 12px;
		font-size: 13px;
		color: var(--text-secondary);
		border-radius: var(--radius);
		margin-bottom: 2px;
		background: var(--bg-base);
	}

	.note-item:hover {
		color: var(--text-primary);
	}

	.empty {
		padding: 24px;
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
