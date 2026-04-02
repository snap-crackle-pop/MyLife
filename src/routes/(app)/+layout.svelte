<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { getFolderTree, createFolder } from '$lib/stores/notes.svelte';
	import { getSidebarOpen, setSidebarOpen, getTheme, toggleTheme } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	let folders = $derived(getFolderTree());
	let selectedFolder = $derived((page.params as { path?: string }).path ?? null);
	let sidebarOpen = $derived(getSidebarOpen());
	let theme = $derived(getTheme());

	async function handleCreateFolder(name: string) {
		await createFolder(name);
		setSidebarOpen(false);
		goto(`${base}/${name}`);
	}

	function handleSelectFolder(path: string) {
		setSidebarOpen(false);
		goto(`${base}/${path}`);
	}
</script>

<div class="app">
	<Sidebar
		{folders}
		{selectedFolder}
		{theme}
		isOpen={sidebarOpen}
		onselectfolder={handleSelectFolder}
		oncreatefolder={handleCreateFolder}
		onclose={() => setSidebarOpen(false)}
		ontoggletheme={toggleTheme}
	/>

	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="drawer-backdrop" onclick={() => setSidebarOpen(false)}></div>
	{/if}

	<main class="main">
		{@render children()}
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

	.drawer-backdrop {
		display: none;
	}

	@media (max-width: 768px) {
		.app {
			flex-direction: column;
		}

		.main {
			overflow-y: auto;
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
