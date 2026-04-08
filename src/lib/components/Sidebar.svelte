<script lang="ts">
	import type { Note, Folder } from '$lib/types';
	import { extractSnippet, countMatches } from '$lib/search';

	interface Props {
		folders: Folder[];
		selectedFolder: string | null;
		notes?: Note[];
		isOpen?: boolean;
		theme?: 'dark' | 'light';
		starredFolders?: string[];
		onselectfolder?: (path: string) => void;
		oncreatefolder?: (name: string) => void;
		onclose?: () => void;
		ontoggletheme?: () => void;
	}

	let {
		folders,
		selectedFolder,
		notes = [],
		isOpen = false,
		theme = 'dark',
		starredFolders = [],
		onselectfolder,
		oncreatefolder,
		onclose,
		ontoggletheme
	}: Props = $props();

	let adding = $state(false);
	let newFolderName = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);
	let searchQuery = $state('');
	let showStarredOnly = $state(false);
	let searchMode = $state(false);

	type SearchResult = {
		folderPath: string;
		snippet: { before: string; match: string; after: string };
		matchCount: number;
	};

	let searchResults = $derived.by((): SearchResult[] => {
		if (!searchMode || !searchQuery.trim()) return [];
		const rawQuery = searchQuery.trim();
		const q = rawQuery.toLowerCase();
		const mapped = notes
			.filter((n) => !n.path.endsWith('.gitkeep') && n.content.toLowerCase().includes(q))
			.map((n) => ({
				folderPath: n.path.split('/').slice(0, -1).join('/'),
				snippet: extractSnippet(n.content, rawQuery),
				matchCount: countMatches(n.content, q)
			}));

		// One result per folder — keep the note with the most matches
		const seen = new Map<string, SearchResult>();
		for (const r of mapped) {
			const existing = seen.get(r.folderPath);
			if (!existing || r.matchCount > existing.matchCount) {
				seen.set(r.folderPath, r);
			}
		}
		return Array.from(seen.values());
	});

	let totalMatchCount = $derived(searchResults.reduce((sum, r) => sum + r.matchCount, 0));

	let filteredFolders = $derived.by(() => {
		// Step 1: apply star filter
		let base = folders;
		if (showStarredOnly) {
			const starFiltered: Folder[] = [];
			for (const folder of folders) {
				const folderStarred = starredFolders.includes(folder.path);
				const starredChildren = folder.children.filter((c) => starredFolders.includes(c.path));
				if (folderStarred || starredChildren.length > 0) {
					starFiltered.push({ ...folder, children: starredChildren });
				}
			}
			base = starFiltered;
		}

		// Step 2: apply search filter
		if (!searchQuery.trim()) return base;
		const q = searchQuery.trim().toLowerCase();
		const result: Folder[] = [];
		for (const folder of base) {
			if (folder.name.toLowerCase().includes(q)) {
				result.push({ ...folder, children: [] });
			} else {
				const matchingChildren = folder.children.filter((c) => c.name.toLowerCase().includes(q));
				if (matchingChildren.length > 0) {
					result.push({ ...folder, children: matchingChildren });
				}
			}
		}
		return result;
	});

	function startAdding() {
		adding = true;
		newFolderName = '';
	}

	$effect(() => {
		if (adding && inputEl) inputEl.focus();
	});

	function confirmAdd() {
		const name = newFolderName.trim();
		if (name) oncreatefolder?.(name);
		adding = false;
		newFolderName = '';
	}

	function cancelAdd() {
		adding = false;
		newFolderName = '';
	}

	$effect(() => {
		if (!isOpen) {
			searchQuery = '';
			searchMode = false;
		}
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmAdd();
		if (e.key === 'Escape') cancelAdd();
	}
</script>

<nav class="sidebar" class:open={isOpen}>
	<div class="sidebar-header">
		<button class="close-btn" onclick={() => onclose?.()} aria-label="Close folders">
			<svg
				width="18"
				height="18"
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

	<div class="search-wrap">
		<input
			class="search-input"
			type="search"
			placeholder={searchMode ? 'Search notes…' : 'Search folders…'}
			bind:value={searchQuery}
			autocomplete="off"
			spellcheck={false}
		/>
		{#if searchMode && searchQuery.trim()}
			<p class="search-count">
				{#if searchResults.length === 0}
					No results
				{:else}
					{totalMatchCount}
					{totalMatchCount === 1 ? 'match' : 'matches'} in {searchResults.length}
					{searchResults.length === 1 ? 'note' : 'notes'}
				{/if}
			</p>
		{/if}
	</div>

	<ul class="folder-list">
		{#if searchMode && searchQuery.trim()}
			{#each searchResults as result (result.folderPath)}
				<li>
					<button
						class="result-item"
						data-folder={result.folderPath}
						onclick={() => {
							onselectfolder?.(result.folderPath);
							searchMode = false;
							searchQuery = '';
						}}
					>
						<span class="result-folder">{result.folderPath.split('/').pop()}</span>
						<span class="result-snippet"
							>{result.snippet.before}<span class="result-match">{result.snippet.match}</span
							>{result.snippet.after}</span
						>
					</button>
				</li>
			{/each}
		{:else}
			{#each filteredFolders as folder (folder.path)}
				<li>
					<button
						class="folder-item"
						data-folder={folder.path}
						data-active={selectedFolder === folder.path}
						onclick={() => onselectfolder?.(folder.path)}
					>
						<span class="folder-icon">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
								<path
									d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
								/>
							</svg>
						</span>
						<span class="folder-name">{folder.name}</span>
						{#if starredFolders.includes(folder.path)}
							<span class="folder-star" aria-hidden="true">
								<svg width="11" height="11" viewBox="0 0 24 24" fill="var(--warning)" stroke="none">
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
							</span>
						{/if}
					</button>
				</li>
				{#each folder.children as child (child.path)}
					<li>
						<button
							class="folder-item subfolder-item"
							data-folder={child.path}
							data-active={selectedFolder === child.path}
							onclick={() => onselectfolder?.(child.path)}
						>
							<span class="folder-icon">
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
								</svg>
							</span>
							<span class="folder-name">{child.name}</span>
							{#if starredFolders.includes(child.path)}
								<span class="folder-star" aria-hidden="true">
									<svg
										width="11"
										height="11"
										viewBox="0 0 24 24"
										fill="var(--warning)"
										stroke="none"
									>
										<polygon
											points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
										/>
									</svg>
								</span>
							{/if}
						</button>
					</li>
				{/each}
			{/each}

			{#if adding}
				<li class="folder-add-row">
					<span class="folder-icon">
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
						</svg>
					</span>
					<input
						bind:this={inputEl}
						class="folder-name-input"
						placeholder="folder name"
						bind:value={newFolderName}
						onkeydown={handleKeyDown}
						onblur={cancelAdd}
					/>
				</li>
			{/if}
		{/if}
	</ul>

	<div class="sidebar-actions">
		<button
			class="action-btn"
			onclick={() => {
				searchMode = !searchMode;
				if (!searchMode) searchQuery = '';
			}}
			aria-pressed={searchMode}
			aria-label="Search notes"
			title="Search notes"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke={searchMode ? 'var(--accent)' : 'currentColor'}
				stroke-width="2"
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
		</button>
		<button class="action-btn" onclick={startAdding} aria-label="New folder" title="New folder">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--accent)"
				stroke-width="2"
			>
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				<line x1="12" y1="11" x2="12" y2="17" />
				<line x1="9" y1="14" x2="15" y2="14" />
			</svg>
		</button>
		<button
			class="action-btn"
			onclick={() => (showStarredOnly = !showStarredOnly)}
			aria-pressed={showStarredOnly}
			aria-label={showStarredOnly ? 'Show all folders' : 'Show starred folders'}
			title={showStarredOnly ? 'Show all folders' : 'Show starred folders'}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill={showStarredOnly ? 'var(--warning)' : 'none'}
				stroke={showStarredOnly ? 'none' : 'currentColor'}
				stroke-width="2"
			>
				<polygon
					points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
				/>
			</svg>
		</button>
		<button
			class="theme-btn"
			onclick={() => ontoggletheme?.()}
			aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if theme === 'dark'}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#f9e2af"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			{:else}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
	</div>
</nav>

<style>
	.sidebar {
		width: 220px;
		min-width: 220px;
		height: 100%;
		background: var(--bg-overlay);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 5px 0 0;
	}

	.folder-list {
		list-style: none;
		flex: 1;
		overflow-y: auto;
	}

	.folder-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 16px;
		font-size: 13px;
		color: var(--text-secondary);
		border-radius: 0;
		text-align: left;
		transition: background 0.1s;
	}

	.folder-item:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.folder-item[data-active='true'] {
		background: var(--bg-surface);
		color: var(--text-primary);
		border-right: 2px solid var(--accent);
	}

	.subfolder-item {
		padding-left: 40px;
		font-size: 12px;
	}

	.folder-add-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
	}

	.folder-name-input {
		flex: 1;
		font-size: 13px;
		padding: 4px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		background: var(--bg-surface);
	}

	.folder-icon {
		color: var(--text-muted);
		display: flex;
		align-items: center;
	}

	.folder-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.folder-star {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.sidebar-actions {
		display: flex;
		border-top: 1px solid var(--border);
		justify-content: space-around;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		min-width: 36px;
		padding: 6px;
		color: var(--text-muted);
		border-radius: var(--radius);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.action-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		min-width: 36px;
		padding: 6px;
		color: var(--text-muted);
		border-radius: var(--radius);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.theme-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.sidebar-header {
		display: none;
	}

	.search-wrap {
		padding: 0px 8px 6px 8px;
	}

	.search-input {
		width: 100%;
		box-sizing: border-box;
		padding: 6px 12px;
		font-size: 13px;
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.search-input:focus {
		border-color: var(--accent);
	}

	.search-count {
		font-size: 11px;
		color: var(--text-muted);
		padding: 2px 4px 0;
		margin: 0;
	}

	.result-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 6px 16px;
		text-align: left;
		border-radius: 0;
		color: var(--text-secondary);
		transition: background 0.1s;
	}

	.result-item:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.result-folder {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.result-snippet {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.result-match {
		background: color-mix(in srgb, var(--warning) 35%, transparent);
		border-radius: 2px;
		color: var(--text-primary);
	}

	.close-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		color: var(--text-muted);
		border-radius: var(--radius);
	}

	.close-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	@media (max-width: 768px) {
		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100%;
			width: 280px;
			z-index: 100;
			transform: translateX(-100%);
			transition: transform 200ms ease;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-header {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			padding: 0 8px 4px 16px;
		}

		.close-btn {
			display: flex;
		}

		.folder-item {
			min-height: 32px;
			padding: 4px 16px;
		}

		.subfolder-item {
			padding-left: 40px;
		}

		.action-btn {
			min-height: 44px;
			width: 44px;
			min-width: 44px;
		}

		.theme-btn {
			min-height: 44px;
			width: 44px;
			min-width: 44px;
		}
	}
</style>
