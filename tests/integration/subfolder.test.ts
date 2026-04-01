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

// ── FolderPanel sub-folder UI ─────────────────────────────────────────────────

describe('FolderPanel sub-folder actions', () => {
	const notes = [
		{
			path: 'work/a.md',
			title: 'A',
			content: '',
			type: 'text' as const,
			pinned: false,
			updatedAt: '',
			sha: ''
		}
	];

	it('shows icon buttons for rename and delete (aria-labels)', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('shows add sub-folder button for a top-level folder', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByRole('button', { name: 'Add sub-folder' })).toBeInTheDocument();
	});

	it('does not show add sub-folder button for a sub-folder', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: {
				folder: 'work/projects',
				notes: [],
				renaming: false,
				renameName: '',
				confirming: false
			}
		});

		expect(screen.queryByRole('button', { name: 'Add sub-folder' })).not.toBeInTheDocument();
	});

	it('calls onstartaddsubfolder when add sub-folder button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartaddsubfolder = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				onstartaddsubfolder
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Add sub-folder' }));

		expect(onstartaddsubfolder).toHaveBeenCalledOnce();
	});

	it('shows inline sub-folder input when addingSubfolder is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: ''
			}
		});

		expect(screen.getByPlaceholderText('sub-folder name')).toBeInTheDocument();
	});

	it('hides action buttons when addingSubfolder is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: ''
			}
		});

		expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Add sub-folder' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
	});

	it('calls onconfirmsubfolder when Enter is pressed in sub-folder input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmsubfolder = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: 'projects',
				onconfirmsubfolder
			}
		});

		await fireEvent.keyDown(screen.getByPlaceholderText('sub-folder name'), { key: 'Enter' });

		expect(onconfirmsubfolder).toHaveBeenCalledOnce();
	});

	it('calls oncancelsubfolder when Escape is pressed in sub-folder input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const oncancelsubfolder = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: '',
				oncancelsubfolder
			}
		});

		await fireEvent.keyDown(screen.getByPlaceholderText('sub-folder name'), { key: 'Escape' });

		expect(oncancelsubfolder).toHaveBeenCalledOnce();
	});

	it('calls onsubfolderinput when typing in the sub-folder input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onsubfolderinput = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				addingSubfolder: true,
				subfolderName: '',
				onsubfolderinput
			}
		});

		await fireEvent.input(screen.getByPlaceholderText('sub-folder name'), {
			target: { value: 'archive' }
		});

		expect(onsubfolderinput).toHaveBeenCalledWith('archive');
	});
});
