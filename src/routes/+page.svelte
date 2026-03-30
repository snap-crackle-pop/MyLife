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
	import { getSelectedFolder, setSelectedFolder } from '$lib/stores/ui.svelte';

	let folders = $derived(getFolderTree());
	let selectedFolder = $derived(getSelectedFolder());
	let folderNotes = $derived(selectedFolder ? getNotesInFolder(selectedFolder) : []);

	async function handleCreateFolder(name: string) {
		await createFolder(name);
		setSelectedFolder(name);
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
</script>

<div class="app">
	<Sidebar
		{folders}
		{selectedFolder}
		onselectfolder={setSelectedFolder}
		oncreatefolder={handleCreateFolder}
	/>

	<main class="main">
		{#if selectedFolder}
			<FolderPanel
				folder={selectedFolder}
				notes={folderNotes}
				onrename={handleRename}
				ondelete={handleDelete}
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
		height: 100vh;
		overflow: hidden;
	}

	.main {
		flex: 1;
		overflow: hidden;
		display: flex;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
