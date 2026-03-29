<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { NoteCache } from '$lib/cache';
	import { initStore, loadNotes } from '$lib/stores/notes.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let checking = $state(true);

	onMount(async () => {
		const cache = new NoteCache();
		const config = await cache.getConfig();

		if (!config) {
			if (!page.url.pathname.includes('/setup')) {
				goto(`${base}/setup`);
			}
			checking = false;
			return;
		}

		initStore(config.token, config.repo);
		await loadNotes();
		checking = false;
	});
</script>

{#if checking}
	<div class="loading">
		<p>Loading...</p>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		color: var(--text-muted);
	}
</style>
