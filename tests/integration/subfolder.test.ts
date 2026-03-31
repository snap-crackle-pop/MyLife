import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// ── Sidebar sub-folder rendering ─────────────────────────────────────────────

describe('Sidebar with sub-folders', () => {
	const folders = [
		{
			path: 'inbox',
			name: 'inbox',
			children: []
		},
		{
			path: 'work',
			name: 'work',
			children: [
				{ path: 'work/projects', name: 'projects', children: [] },
				{ path: 'work/meetings', name: 'meetings', children: [] }
			]
		}
	];

	it('renders sub-folder names in the list', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders, selectedFolder: null } });

		expect(screen.getByText('projects')).toBeInTheDocument();
		expect(screen.getByText('meetings')).toBeInTheDocument();
	});

	it('sub-folder items have data-folder set to their full path', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders, selectedFolder: null } });

		expect(screen.getByText('projects').closest('[data-folder]')).toHaveAttribute(
			'data-folder',
			'work/projects'
		);
	});

	it('clicking a sub-folder calls onselectfolder with the full path', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const onselectfolder = vi.fn();
		render(Sidebar, { props: { folders, selectedFolder: null, onselectfolder } });

		await fireEvent.click(screen.getByText('projects').closest('[data-folder]')!);

		expect(onselectfolder).toHaveBeenCalledWith('work/projects');
	});

	it('highlights active sub-folder with data-active', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders, selectedFolder: 'work/projects' } });

		const projectsItem = screen.getByText('projects').closest('[data-folder]');
		expect(projectsItem).toHaveAttribute('data-active', 'true');

		const workItem = screen.getByText('work').closest('[data-folder]');
		expect(workItem).toHaveAttribute('data-active', 'false');
	});

	it('does not render sub-folder children (depth capped at 1)', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const foldersWithDeep = [
			{
				path: 'work',
				name: 'work',
				children: [
					{
						path: 'work/projects',
						name: 'projects',
						children: [{ path: 'work/projects/active', name: 'active', children: [] }]
					}
				]
			}
		];
		render(Sidebar, { props: { folders: foldersWithDeep, selectedFolder: null } });

		expect(screen.queryByText('active')).not.toBeInTheDocument();
	});
});
