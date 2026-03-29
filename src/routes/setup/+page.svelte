<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { NoteCache } from '$lib/cache';
	import { GitHubClient } from '$lib/github';

	let token = $state('');
	let repo = $state('');
	let error = $state('');
	let testing = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		testing = true;

		try {
			const client = new GitHubClient(token, repo);
			await client.validateConnection();

			const cache = new NoteCache();
			await cache.saveConfig({ token, repo });

			goto(`${base}/`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Connection failed. Check your token and repo name.';
		} finally {
			testing = false;
		}
	}
</script>

<div class="setup">
	<div class="setup-card">
		<h1>MyLife</h1>
		<p class="subtitle">Connect your GitHub repo to get started.</p>

		<form onsubmit={handleSubmit}>
			<label>
				<span>GitHub Personal Access Token</span>
				<input type="password" bind:value={token} placeholder="ghp_xxxxxxxxxxxx" required />
				<span class="hint">Needs "repo" scope for private repo access.</span>
			</label>

			<label>
				<span>Repository</span>
				<input type="text" bind:value={repo} placeholder="username/mylife-notes" required />
				<span class="hint">Format: owner/repo-name</span>
			</label>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button type="submit" disabled={testing || !token || !repo}>
				{testing ? 'Testing connection...' : 'Connect'}
			</button>
		</form>
	</div>
</div>

<style>
	.setup {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 20px;
	}

	.setup-card {
		max-width: 420px;
		width: 100%;
	}

	h1 {
		font-size: 28px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.subtitle {
		color: var(--text-secondary);
		margin-bottom: 32px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label span:first-child {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.hint {
		font-size: 12px;
		color: var(--text-muted);
	}

	.error {
		color: var(--danger);
		font-size: 13px;
	}

	button[type='submit'] {
		background: var(--accent);
		color: var(--bg-base);
		padding: 10px 20px;
		border-radius: var(--radius);
		font-weight: 600;
		font-size: 14px;
		transition: opacity 0.15s;
	}

	button[type='submit']:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
