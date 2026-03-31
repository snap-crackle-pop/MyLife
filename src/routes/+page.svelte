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
	let prevFolder: string | null = null;
	$effect(() => {
		if (selectedFolder !== prevFolder) {
			renaming = false;
			confirming = false;
			prevFolder = selectedFolder;
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

	const folderDisplayName = $derived(selectedFolder?.split('/').pop() ?? '');
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

			{#if selectedFolder && renaming}
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
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</button>
				<button class="header-icon-btn" onclick={cancelRename} aria-label="Cancel rename">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{:else if selectedFolder}
				<span class="app-title" role="heading" aria-level="2">{folderDisplayName}</span>
				<button class="header-icon-btn" onclick={startRename} aria-label="Rename">
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
				</button>
				<button class="header-icon-btn danger" onclick={startDelete} aria-label="Delete">
					<svg
						width="17"
						height="17"
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
			{:else}
				<span class="app-title">MyLife</span>
			{/if}
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

		.drawer-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.4);
			z-index: 99;
		}
	}
</style>
