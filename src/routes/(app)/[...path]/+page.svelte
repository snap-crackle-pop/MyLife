<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import FolderPanel from '$lib/components/FolderPanel.svelte';
	import type { Folder } from '$lib/types';
	import {
		getFolderTree,
		getFolderNote,
		updateNote,
		renameFolder,
		deleteFolder,
		createFolder,
		isInitialized
	} from '$lib/stores/notes.svelte';
	import { setSidebarOpen } from '$lib/stores/ui.svelte';

	let selectedFolder = $derived(page.params.path!);
	let folders = $derived(getFolderTree());
	let folderNote = $derived(getFolderNote(selectedFolder));

	let renaming = $state(false);
	let renameName = $state('');
	let confirming = $state(false);
	let addingSubfolder = $state(false);
	let subfolderName = $state('');

	function folderExists(tree: Folder[], path: string): boolean {
		for (const f of tree) {
			if (f.path === path) return true;
			if (folderExists(f.children, path)) return true;
		}
		return false;
	}

	// Redirect to root if the folder no longer exists (e.g. deleted, or stale URL)
	$effect(() => {
		if (!isInitialized()) return;
		if (!folderExists(folders, selectedFolder)) {
			goto(`${base}/`);
		}
	});

	// Reset interaction state when navigating to a different folder
	let prevFolder = $state('');
	$effect(() => {
		if (selectedFolder !== prevFolder) {
			renaming = false;
			confirming = false;
			addingSubfolder = false;
			prevFolder = selectedFolder;
		}
	});

	function startRename() {
		renameName = selectedFolder.split('/').pop() ?? '';
		renaming = true;
		confirming = false;
		addingSubfolder = false;
	}

	function confirmRename() {
		const name = renameName.trim();
		if (name && name !== selectedFolder.split('/').pop()) handleRename(name);
		renaming = false;
	}

	function cancelRename() {
		renaming = false;
	}

	function startDelete() {
		confirming = true;
		renaming = false;
		addingSubfolder = false;
	}

	function cancelDelete() {
		confirming = false;
	}

	async function confirmDelete() {
		confirming = false;
		await handleDelete(selectedFolder);
	}

	function startAddSubfolder() {
		addingSubfolder = true;
		subfolderName = '';
		renaming = false;
		confirming = false;
	}

	function cancelAddSubfolder() {
		addingSubfolder = false;
	}

	async function confirmAddSubfolder() {
		const name = subfolderName.trim();
		addingSubfolder = false;
		if (name) {
			const path = `${selectedFolder}/${name}`;
			await createFolder(path);
			goto(`${base}/${path}`);
		}
	}

	async function handleRename(newName: string) {
		const parts = selectedFolder.split('/');
		const fullNewPath = parts.length > 1 ? `${parts.slice(0, -1).join('/')}/${newName}` : newName;
		await renameFolder(selectedFolder, fullNewPath);
		goto(`${base}/${fullNewPath}`);
	}

	async function handleDelete(folder: string) {
		await deleteFolder(folder);
		goto(`${base}/`);
	}

	async function handleSave(content: string) {
		if (!folderNote) return;
		await updateNote(folderNote.path, content);
	}

	const folderDisplayName = $derived(selectedFolder.split('/').pop() ?? '');
	const selectedIsTopLevel = $derived(!selectedFolder.includes('/'));
</script>

<div class="mobile-header">
	<button class="hamburger" onclick={() => setSidebarOpen(true)} aria-label="Open folders">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="21" y2="18" />
		</svg>
	</button>

	{#if renaming}
		<input
			class="mobile-rename-input"
			value={renameName}
			oninput={(e) => (renameName = (e.target as HTMLInputElement).value)}
			onkeydown={(e) => {
				if (e.key === 'Enter') confirmRename();
				if (e.key === 'Escape') cancelRename();
			}}
			onblur={cancelRename}
		/>
		<button
			class="header-icon-btn confirm"
			onmousedown={(e) => e.preventDefault()}
			onclick={confirmRename}
			aria-label="Confirm rename"
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
		<button class="header-icon-btn" onclick={cancelRename} aria-label="Cancel rename">
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
	{:else}
		<span class="app-title" role="heading" aria-level="2">{folderDisplayName}</span>
		{#if !confirming && !addingSubfolder}
			<button class="header-icon-btn" onclick={startRename} aria-label="Rename">
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
			{#if selectedIsTopLevel}
				<button class="header-icon-btn" onclick={startAddSubfolder} aria-label="Add sub-folder">
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
				</button>
			{/if}
			<button class="header-icon-btn danger" onclick={startDelete} aria-label="Delete">
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
	{/if}
</div>

<FolderPanel
	folder={selectedFolder}
	note={folderNote}
	{renaming}
	{renameName}
	{confirming}
	{addingSubfolder}
	{subfolderName}
	onstartrename={startRename}
	onstartdelete={startDelete}
	onstartaddsubfolder={startAddSubfolder}
	onrenameinput={(v) => (renameName = v)}
	onconfirmrename={confirmRename}
	oncancelrename={cancelRename}
	onconfirmdelete={confirmDelete}
	oncanceldelete={cancelDelete}
	onsubfolderinput={(v) => (subfolderName = v)}
	onconfirmsubfolder={confirmAddSubfolder}
	oncancelsubfolder={cancelAddSubfolder}
	onsave={handleSave}
/>

<style>
	.mobile-header {
		display: none;
	}

	@media (max-width: 768px) {
		.mobile-header {
			display: flex;
			align-items: center;
			gap: 12px;
			height: 48px;
			padding: 0 4px 0 0;
			background: var(--bg-overlay);
			border-bottom: 1px solid var(--border);
			flex-shrink: 0;
		}

		.hamburger {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 44px;
			color: var(--text-secondary);
			border-radius: var(--radius);
		}

		.hamburger:hover {
			background: var(--bg-surface);
			color: var(--text-primary);
		}

		.header-icon-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 40px;
			height: 44px;
			color: var(--text-secondary);
			border-radius: var(--radius);
			flex-shrink: 0;
		}

		.header-icon-btn:hover {
			background: var(--bg-surface);
			color: var(--text-primary);
		}

		.header-icon-btn.danger {
			color: var(--danger);
		}

		.header-icon-btn.confirm {
			color: var(--success);
		}

		.mobile-rename-input {
			flex: 1;
			height: 32px;
			background: var(--bg-surface);
			border: 1px solid var(--accent);
			border-radius: var(--radius);
			color: var(--text-primary);
			font-size: 14px;
			font-weight: 600;
			padding: 0 8px;
		}

		.app-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--text-primary);
			flex: 1;
		}
	}
</style>
