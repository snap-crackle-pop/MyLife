import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createMockFetch, githubResponse, createTestNote } from '../factories';
import { buildFolderTree } from '$lib/stores/notes.svelte';

// Mock only the network boundary
const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
	mockFetch.mockReset();
});

// --- Pure utility: folder tree includes folders created via .gitkeep ---

describe('buildFolderTree with .gitkeep placeholder', () => {
	it('includes an empty folder created by a .gitkeep file', () => {
		const paths = ['inbox/note.md', 'projects/.gitkeep'];
		const tree = buildFolderTree(paths);
		expect(tree.map((f) => f.name)).toContain('projects');
	});
});

// --- Sidebar component ---

describe('Sidebar', () => {
	it('renders a list of folders', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const folders = [
			{ path: 'inbox', name: 'inbox', children: [] },
			{ path: 'work', name: 'work', children: [] }
		];
		render(Sidebar, { props: { folders, selectedFolder: null } });

		expect(screen.getByText('inbox')).toBeInTheDocument();
		expect(screen.getByText('work')).toBeInTheDocument();
	});

	it('highlights the selected folder', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const folders = [
			{ path: 'inbox', name: 'inbox', children: [] },
			{ path: 'work', name: 'work', children: [] }
		];
		render(Sidebar, { props: { folders, selectedFolder: 'inbox' } });

		const inboxItem = screen.getByText('inbox').closest('[data-folder]');
		expect(inboxItem).toHaveAttribute('data-active', 'true');
	});

	it('shows an inline input when the add folder button is clicked', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		render(Sidebar, { props: { folders: [], selectedFolder: null } });

		fireEvent.click(screen.getByRole('button', { name: /new folder/i }));

		expect(screen.getByPlaceholderText(/folder name/i)).toBeInTheDocument();
	});

	it('calls oncreatefolder with the name when Enter is pressed', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const oncreatefolder = vi.fn();
		render(Sidebar, { props: { folders: [], selectedFolder: null, oncreatefolder } });

		fireEvent.click(screen.getByRole('button', { name: /new folder/i }));
		const input = screen.getByPlaceholderText(/folder name/i);
		await fireEvent.input(input, { target: { value: 'projects' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(oncreatefolder).toHaveBeenCalledWith('projects');
	});

	it('cancels inline input on Escape without calling oncreatefolder', async () => {
		const { default: Sidebar } = await import('$lib/components/Sidebar.svelte');
		const oncreatefolder = vi.fn();
		render(Sidebar, { props: { folders: [], selectedFolder: null, oncreatefolder } });

		fireEvent.click(screen.getByRole('button', { name: /new folder/i }));
		const input = screen.getByPlaceholderText(/folder name/i);
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(oncreatefolder).not.toHaveBeenCalled();
		expect(screen.queryByPlaceholderText(/folder name/i)).not.toBeInTheDocument();
	});
});

// --- FolderPanel component ---

describe('FolderPanel', () => {
	const notes = [
		createTestNote({ path: 'work/task.md' }),
		createTestNote({ path: 'work/meeting.md' })
	];

	it('shows the folder name and note count', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByText('work')).toBeInTheDocument();
		expect(screen.getByText(/2 notes/i)).toBeInTheDocument();
	});

	it('lists note titles inside the folder', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByText(notes[0].title)).toBeInTheDocument();
		expect(screen.getByText(notes[1].title)).toBeInTheDocument();
	});

	it('calls onstartrename when Rename button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				onstartrename
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /rename/i }));

		expect(onstartrename).toHaveBeenCalledOnce();
	});

	it('shows rename input when renaming prop is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: true, renameName: 'work', confirming: false }
		});

		expect(screen.getByDisplayValue('work')).toBeInTheDocument();
	});

	it('calls onrenameinput with new value when rename input changes', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onrenameinput = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: true,
				renameName: 'work',
				confirming: false,
				onrenameinput
			}
		});

		const input = screen.getByDisplayValue('work');
		await fireEvent.input(input, { target: { value: 'projects' } });

		expect(onrenameinput).toHaveBeenCalledWith('projects');
	});

	it('calls onconfirmrename when Enter is pressed in rename input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: true,
				renameName: 'projects',
				confirming: false,
				onconfirmrename
			}
		});

		const input = screen.getByDisplayValue('projects');
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(onconfirmrename).toHaveBeenCalledOnce();
	});

	it('calls oncancelrename when Escape is pressed in rename input', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const oncancelrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: true,
				renameName: 'work',
				confirming: false,
				oncancelrename
			}
		});

		const input = screen.getByDisplayValue('work');
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(oncancelrename).toHaveBeenCalledOnce();
	});

	it('calls onstartdelete when Delete button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartdelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: false,
				onstartdelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /delete/i }));

		expect(onstartdelete).toHaveBeenCalledOnce();
	});

	it('shows delete confirmation when confirming prop is true', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', notes, renaming: false, renameName: '', confirming: true }
		});

		expect(screen.getByText(/2 notes will be moved to trash/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
	});

	it('calls onconfirmdelete when Confirm is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmdelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: true,
				onconfirmdelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

		expect(onconfirmdelete).toHaveBeenCalledOnce();
	});

	it('calls oncanceldelete when Cancel is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const oncanceldelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				notes,
				renaming: false,
				renameName: '',
				confirming: true,
				oncanceldelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

		expect(oncanceldelete).toHaveBeenCalledOnce();
	});

	it('shows empty state when folder has no notes', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'empty', notes: [], renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByText(/no notes/i)).toBeInTheDocument();
	});

	it('does not show trash warning when folder is empty', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'empty', notes: [], renaming: false, renameName: '', confirming: true }
		});

		expect(screen.queryByText(/will be moved to trash/i)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
	});

	// GitHub API tests for createFolder, renameFolder, deleteFolder
	describe('createFolder via GitHubClient', () => {
		it('creates a .gitkeep placeholder file in the new folder', async () => {
			const { GitHubClient } = await import('$lib/github');
			const client = new GitHubClient('token', 'user/repo');
			mockFetch.mockResolvedValueOnce(githubResponse({ content: { sha: 'abc' } }));

			await client.createFile('projects/.gitkeep', '');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/contents/projects/.gitkeep'),
				expect.objectContaining({ method: 'PUT' })
			);
		});
	});
});
