<script lang="ts">
	import { getNotes, createNote } from '$lib/stores/notes.svelte';

	let notes = $derived(getNotes());
	let creating = $state(false);
	let message = $state('');

	async function handleCreateNote() {
		creating = true;
		message = '';
		try {
			const note = await createNote('inbox', 'My first note', 'text');
			message = `Note created! Path: ${note.path}, SHA: ${note.sha}`;
		} catch (e) {
			message = `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
		} finally {
			creating = false;
		}
	}
</script>

<div style="padding: 40px; max-width: 600px;">
	<h1>MyLife</h1>
	<p style="color: var(--text-secondary); margin: 8px 0 24px;">Infrastructure verification</p>

	<button
		onclick={handleCreateNote}
		disabled={creating}
		style="background: var(--accent); color: var(--bg-base); padding: 10px 20px; border-radius: var(--radius); font-weight: 600; font-size: 14px;"
	>
		{creating ? 'Creating...' : 'Create Test Note in Inbox'}
	</button>

	{#if message}
		<p style="margin-top: 16px; font-size: 13px; color: var(--success);">{message}</p>
	{/if}

	<h2 style="margin-top: 32px; font-size: 16px; color: var(--text-secondary);">
		Cached Notes ({notes.length})
	</h2>

	{#if notes.length === 0}
		<p style="color: var(--text-muted); font-size: 14px;">
			No notes yet. Create one above, then reload to verify rehydration.
		</p>
	{:else}
		<ul style="list-style: none; margin-top: 12px;">
			{#each notes as note (note.path)}
				<li style="padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px;">
					<strong>{note.title}</strong>
					<span style="color: var(--text-muted); font-size: 12px; margin-left: 8px;"
						>{note.path}</span
					>
					<span style="color: var(--text-muted); font-size: 11px; margin-left: 8px;"
						>sha: {note.sha.slice(0, 7)}</span
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
