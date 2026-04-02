<script lang="ts">
	import type { Note } from '$lib/types';

	interface Props {
		folder: string;
		note: Note | null;
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
		onsave?: (content: string) => void;
	}

	let {
		folder,
		note,
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
		oncancelsubfolder,
		onsave
	}: Props = $props();

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmrename?.();
		if (e.key === 'Escape') oncancelrename?.();
	}

	function handleSubfolderKey(e: KeyboardEvent) {
		if (e.key === 'Enter') onconfirmsubfolder?.();
		if (e.key === 'Escape') oncancelsubfolder?.();
	}

	const folderDisplayName = $derived(folder.split('/').pop() ?? folder);
	const isTopLevel = $derived(!folder.includes('/'));

	let subfolderInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (addingSubfolder && subfolderInputEl) subfolderInputEl.focus();
	});

	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		void folder;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		return () => {
			if (saveTimer) clearTimeout(saveTimer);
		};
	});

	function handleInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			onsave?.(value);
		}, 800);
	}
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
			{#if renaming}
				<button
					class="action-btn icon-btn confirm"
					onmousedown={(e) => e.preventDefault()}
					onclick={onconfirmrename}
					aria-label="Confirm rename"
					title="Confirm rename"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</button>
				<button
					class="action-btn icon-btn"
					onmousedown={(e) => e.preventDefault()}
					onclick={oncancelrename}
					aria-label="Cancel rename"
					title="Cancel rename"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{:else if !confirming && !addingSubfolder}
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
			<button
				class="action-btn icon-btn confirm"
				onmousedown={(e) => e.preventDefault()}
				onclick={onconfirmsubfolder}
				aria-label="Confirm sub-folder"
				title="Confirm"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			</button>
			<button
				class="action-btn icon-btn"
				onmousedown={(e) => e.preventDefault()}
				onclick={oncancelsubfolder}
				aria-label="Cancel sub-folder"
				title="Cancel"
			>
				<svg
					width="16"
					height="16"
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
	{/if}

	{#if confirming}
		<div class="confirm-bar">
			<span class="confirm-msg">Delete <strong>{folderDisplayName}</strong>?</span>
			<button class="action-btn danger" onclick={onconfirmdelete} aria-label="Confirm"
				>Confirm</button
			>
			<button class="action-btn" onclick={oncanceldelete} aria-label="Cancel">Cancel</button>
		</div>
	{/if}

	<textarea
		class="note-editor"
		value={note?.content ?? ''}
		oninput={handleInput}
		placeholder="Start writing..."
	></textarea>
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

	.icon-btn.confirm {
		color: var(--success);
		border: none;
	}

	.icon-btn.confirm:hover {
		background: var(--bg-surface);
		color: var(--success);
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

	.note-editor {
		flex: 1;
		width: 100%;
		padding: 16px 24px;
		background: var(--bg-surface);
		border: none;
		resize: none;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-primary);
		outline: none;
		box-sizing: border-box;
	}

	.note-editor::placeholder {
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
	}
</style>
