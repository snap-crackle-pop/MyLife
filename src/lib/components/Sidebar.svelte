<script lang="ts">
	import type { Folder } from '$lib/types';

	interface Props {
		folders: Folder[];
		selectedFolder: string | null;
		onselectfolder?: (path: string) => void;
		oncreatefolder?: (name: string) => void;
	}

	let { folders, selectedFolder, onselectfolder, oncreatefolder }: Props = $props();

	let adding = $state(false);
	let newFolderName = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	function startAdding() {
		adding = true;
		newFolderName = '';
	}

	$effect(() => {
		if (adding && inputEl) inputEl.focus();
	});

	function confirmAdd() {
		const name = newFolderName.trim();
		if (name) oncreatefolder?.(name);
		adding = false;
		newFolderName = '';
	}

	function cancelAdd() {
		adding = false;
		newFolderName = '';
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmAdd();
		if (e.key === 'Escape') cancelAdd();
	}
</script>

<nav class="sidebar">
	<div class="sidebar-header">Folders</div>

	<ul class="folder-list">
		{#each folders as folder (folder.path)}
			<li>
				<button
					class="folder-item"
					data-folder={folder.path}
					data-active={selectedFolder === folder.path}
					onclick={() => onselectfolder?.(folder.path)}
				>
					<span class="folder-icon">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
							/>
						</svg>
					</span>
					{folder.name}
				</button>
			</li>
		{/each}

		{#if adding}
			<li class="folder-add-row">
				<span class="folder-icon">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
					</svg>
				</span>
				<input
					bind:this={inputEl}
					class="folder-name-input"
					placeholder="folder name"
					bind:value={newFolderName}
					onkeydown={handleKeyDown}
					onblur={cancelAdd}
				/>
			</li>
		{/if}
	</ul>

	<div class="sidebar-actions">
		<button class="action-btn" onclick={startAdding} aria-label="New folder" title="New folder">
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				<line x1="12" y1="11" x2="12" y2="17" />
				<line x1="9" y1="14" x2="15" y2="14" />
			</svg>
			New folder
		</button>

		<button
			class="action-btn trash-btn"
			class:active={selectedFolder === '.trash'}
			onclick={() => onselectfolder?.('.trash')}
			aria-label="Trash"
			title="Trash"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="3 6 5 6 21 6" />
				<path d="M19 6l-1 14H6L5 6" />
				<path d="M10 11v6" />
				<path d="M14 11v6" />
				<path d="M9 6V4h6v2" />
			</svg>
			Trash
		</button>
	</div>
</nav>

<style>
	.sidebar {
		width: 220px;
		min-width: 220px;
		height: 100%;
		background: var(--bg-overlay);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 16px 0 0;
	}

	.sidebar-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--text-muted);
		padding: 0 16px 10px;
	}

	.folder-list {
		list-style: none;
		flex: 1;
		overflow-y: auto;
	}

	.folder-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 16px;
		font-size: 13px;
		color: var(--text-secondary);
		border-radius: 0;
		text-align: left;
		transition: background 0.1s;
	}

	.folder-item:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.folder-item[data-active='true'] {
		background: var(--bg-surface);
		color: var(--text-primary);
		border-right: 2px solid var(--accent);
	}

	.folder-add-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 16px;
	}

	.folder-name-input {
		flex: 1;
		font-size: 13px;
		padding: 4px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-surface);
	}

	.folder-icon {
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.sidebar-actions {
		display: flex;
		border-top: 1px solid var(--border);
		padding: 8px;
		gap: 4px;
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 6px 8px;
		font-size: 12px;
		color: var(--text-muted);
		border-radius: var(--radius);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.action-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.trash-btn.active {
		color: var(--accent);
		background: var(--bg-surface);
	}
</style>
