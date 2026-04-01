<script lang="ts">
	import type { Folder } from '$lib/types';

	interface Props {
		folders: Folder[];
		selectedFolder: string | null;
		isOpen?: boolean;
		onselectfolder?: (path: string) => void;
		oncreatefolder?: (name: string) => void;
		onclose?: () => void;
	}

	let {
		folders,
		selectedFolder,
		isOpen = false,
		onselectfolder,
		oncreatefolder,
		onclose
	}: Props = $props();

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

<nav class="sidebar" class:open={isOpen}>
	<div class="sidebar-header">
		<button class="close-btn" onclick={() => onclose?.()} aria-label="Close folders">
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>

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
							width="16"
							height="16"
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
			{#each folder.children as child (child.path)}
				<li>
					<button
						class="folder-item subfolder-item"
						data-folder={child.path}
						data-active={selectedFolder === child.path}
						onclick={() => onselectfolder?.(child.path)}
					>
						<span class="folder-icon">
							<svg
								width="16"
								height="16"
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
						{child.name}
					</button>
				</li>
			{/each}
		{/each}

		{#if adding}
			<li class="folder-add-row">
				<span class="folder-icon">
					<svg
						width="16"
						height="16"
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
				width="16"
				height="16"
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
		padding: 5px 0 0;
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
		padding: 8px 16px;
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

	.subfolder-item {
		padding-left: 32px;
		font-size: 12px;
	}

	.folder-add-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
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
		padding: 0px;
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

	.sidebar-header {
		display: none;
	}

	.close-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		color: var(--text-muted);
		border-radius: var(--radius);
	}

	.close-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	@media (max-width: 768px) {
		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100%;
			width: 280px;
			z-index: 100;
			transform: translateX(-100%);
			transition: transform 200ms ease;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-header {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			padding: 0 8px 10px 16px;
		}

		.close-btn {
			display: flex;
		}

		.folder-item {
			min-height: 44px;
			padding: 10px 16px;
		}

		.action-btn {
			min-height: 44px;
			padding: 10px 8px;
		}
	}
</style>
