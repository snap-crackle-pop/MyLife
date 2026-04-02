<script lang="ts">
	import { setSidebarOpen } from '$lib/stores/ui.svelte';
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
	<span class="app-title">MyLife</span>
</div>

<div class="empty-state">
	<p>Select a folder or create one to get started.</p>
</div>

<style>
	.mobile-header {
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
			flex: 1;
		}
	}
</style>
