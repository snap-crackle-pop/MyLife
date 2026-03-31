<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import FolderPanel from '$lib/components/FolderPanel.svelte';
	import {
		getFolderTree,
		getNotesInFolder,
		createFolder,
		renameFolder,
		deleteFolder
	} from '$lib/stores/notes.svelte';
	import {
		getSelectedFolder,
		setSelectedFolder,
		getSidebarOpen,
		setSidebarOpen
	} from '$lib/stores/ui.svelte';

	let folders = $derived(getFolderTree());
	let selectedFolder = $derived(getSelectedFolder());
	let folderNotes = $derived(selectedFolder ? getNotesInFolder(selectedFolder) : []);
	let sidebarOpen = $derived(getSidebarOpen());

	// Rename / confirm state owned here so the mobile header can drive it
	let renaming = $state(false);
	let renameName = $state('');
	let confirming = $state(false);

	// Reset interaction state whenever the active folder changes
	$effect(() => {
		if (selectedFolder !== undefined) {
			renaming = false;
			confirming = false;
		}
	});

	function startRename() {
		renameName = selectedFolder?.split('/').pop() ?? '';
		renaming = true;
		confirming = false;
	}

	function confirmRename() {
		const name = renameName.trim();
		if (name && name !== selectedFolder?.split('/').pop()) handleRename(name);
		renaming = false;
	}

	function cancelRename() {
		renaming = false;
	}

	function startDelete() {
		confirming = true;
		renaming = false;
	}

	function cancelDelete() {
		confirming = false;
	}

	async function confirmDelete() {
		confirming = false;
		if (selectedFolder) await handleDelete(selectedFolder);
	}

	async function handleCreateFolder(name: string) {
		await createFolder(name);
		setSelectedFolder(name);
		setSidebarOpen(false);
	}

	async function handleRename(newName: string) {
		if (!selectedFolder) return;
		await renameFolder(selectedFolder, newName);
		setSelectedFolder(newName);
	}

	async function handleDelete(folder: string) {
		await deleteFolder(folder);
		setSelectedFolder(null);
	}

	function handleSelectFolder(path: string) {
		setSelectedFolder(path);
		setSidebarOpen(false);
	}
</script>

<div class="app">
	<Sidebar
		{folders}
		{selectedFolder}
		isOpen={sidebarOpen}
		onselectfolder={handleSelectFolder}
		oncreatefolder={handleCreateFolder}
		onclose={() => setSidebarOpen(false)}
	/>

	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="drawer-backdrop" onclick={() => setSidebarOpen(false)}></div>
	{/if}

	<main class="main">
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
			<span class="app-title">MyLife</span>
		</div>

		{#if selectedFolder}
			<FolderPanel
				folder={selectedFolder}
				notes={folderNotes}
				{renaming}
				{renameName}
				{confirming}
				onstartrename={startRename}
				onstartdelete={startDelete}
				onrenameinput={(v) => (renameName = v)}
				onconfirmrename={confirmRename}
				oncancelrename={cancelRename}
				onconfirmdelete={confirmDelete}
				oncanceldelete={cancelDelete}
			/>
		{:else}
			<div class="empty-state">
				<p>Select a folder or create one to get started.</p>
			</div>
		{/if}
	</main>
</div>

<style>
	.app {
		display: flex;
		height: 100dvh;
		overflow: hidden;
	}

	.main {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.mobile-header {
		display: none;
	}

	.drawer-backdrop {
		display: none;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 14px;
	}

	@media (max-width: 768px) {
		.app {
			flex-direction: column;
		}

		.main {
			overflow-y: auto;
		}

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

		.app-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--text-primary);
		}

		.drawer-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.4);
			z-index: 99;
		}
	}
</style>
