<script lang="ts">
	import type { Note } from '$lib/types';

	interface Props {
		folder: string;
		notes: Note[];
		renaming: boolean;
		renameName: string;
		confirming: boolean;
		addingSubfolder?: boolean;
		subfolderName?: string;
		onstartrename?: () => void;
		onstartdelete?: () => void;
		onstartaddsubfolder?: () => void;
		onrenameinput?: (value: string) => void;
		onconfirmrename?: () => void;
		oncancelrename?: () => void;
		onconfirmdelete?: () => void;
		oncanceldelete?: () => void;
		onsubfolderinput?: (value: string) => void;
		onconfirmsubfolder?: () => void;
		oncancelsubfolder?: () => void;
	}

	let {
		folder,
		notes,
		renaming,
		renameName,
		confirming,
		addingSubfolder = false,
		subfolderName = '',
		onstartrename,
		onstartdelete,
		onstartaddsubfolder,
		onrenameinput,
		onconfirmrename,
		oncancelrename,
		onconfirmdelete,
		oncanceldelete,
		onsubfolderinput,
		onconfirmsubfolder,
		oncancelsubfolder
	}: Props = $props();

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmrename?.();
		if (e.key === 'Escape') oncancelrename?.();
	}

	function handleSubfolderKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmsubfolder?.();
		if (e.key === 'Escape') oncancelsubfolder?.();
	}

	const realNotes = $derived(notes.filter((n) => !n.path.endsWith('.gitkeep')));
	const folderDisplayName = $derived(folder.split('/').pop() ?? folder);
	const isTopLevel = $derived(!folder.includes('/'));

	let subfolderInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (addingSubfolder && subfolderInputEl) subfolderInputEl.focus();
	});
</script>

<div class="panel">
	<header class="panel-header">
		{#if renaming}
			<input
				class="rename-input"
				value={renameName}
				oninput={(e) => onrenameinput?.((e.target as HTMLInputElement).value)}
				onkeydown={handleRenameKey}
				onblur={() => oncancelrename?.()}
			/>
		{:else}
			<h2 class="folder-title">{folderDisplayName}</h2>
		{/if}

		<div class="actions">
			{#if !renaming && !confirming && !addingSubfolder}
				<button
					class="action-btn icon-btn"
					onclick={onstartrename}
					aria-label="Rename"
					title="Rename"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
				</button>
				{#if isTopLevel}
					<button
						class="action-btn icon-btn"
						onclick={onstartaddsubfolder}
						aria-label="Add sub-folder"
						title="Add sub-folder"
					>
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
							<line x1="12" y1="11" x2="12" y2="17" />
							<line x1="9" y1="14" x2="15" y2="14" />
						</svg>
					</button>
				{/if}
				<button
					class="action-btn icon-btn danger"
					onclick={onstartdelete}
					aria-label="Delete"
					title="Delete"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
						<path d="M10 11v6" />
						<path d="M14 11v6" />
						<path d="M9 6V4h6v2" />
					</svg>
				</button>
			{/if}
		</div>
	</header>

	{#if addingSubfolder}
		<div class="subfolder-add-row">
			<span class="subfolder-icon">
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
				bind:this={subfolderInputEl}
				class="subfolder-input"
				placeholder="sub-folder name"
				value={subfolderName}
				oninput={(e) => onsubfolderinput?.((e.target as HTMLInputElement).value)}
				onkeydown={handleSubfolderKey}
				onblur={() => oncancelsubfolder?.()}
			/>
		</div>
	{/if}

	{#if confirming}
		<div class="confirm-bar">
			{#if realNotes.length > 0}
				<span class="confirm-msg">
					{realNotes.length}
					{realNotes.length === 1 ? 'note' : 'notes'} will be permanently deleted. Delete
					<strong>{folderDisplayName}</strong>?
				</span>
			{:else}
				<span class="confirm-msg">Delete <strong>{folderDisplayName}</strong>?</span>
			{/if}
			<button class="action-btn danger" onclick={onconfirmdelete} aria-label="Confirm"
				>Confirm</button
			>
			<button class="action-btn" onclick={oncanceldelete} aria-label="Cancel">Cancel</button>
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
		padding: 2px 2px 2px 5px;
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
		gap: 6px;
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

	.icon-btn {
		width: 32px;
		height: 32px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.icon-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
		border: none;
	}

	.icon-btn.danger {
		border: none;
	}

	.icon-btn.danger:hover {
		background: var(--bg-surface);
		color: var(--danger);
	}

	.subfolder-add-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-base);
	}

	.subfolder-icon {
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.subfolder-input {
		flex: 1;
		font-size: 13px;
		padding: 4px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-surface);
		color: var(--text-primary);
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

	@media (max-width: 768px) {
		.panel-header {
			display: none;
		}

		.action-btn {
			min-height: 44px;
			padding: 10px 14px;
		}

		.icon-btn {
			min-height: 44px;
			width: 44px;
			padding: 0;
		}

		.note-item {
			min-height: 44px;
			padding: 10px 12px;
			display: flex;
			align-items: center;
		}
	}
</style>
