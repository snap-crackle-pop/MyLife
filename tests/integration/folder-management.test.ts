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

// --- Pure utility: folder tree includes folders created via index.md ---

describe('buildFolderTree with index.md placeholder', () => {
	it('includes an empty folder created by an index.md file', () => {
		const paths = ['inbox/note.md', 'projects/index.md'];
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
	const note = createTestNote({ path: 'work/index.md', content: 'hello' });

	it('calls onstartrename when Rename button is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onstartrename = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				note,
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
			props: { folder: 'work', note, renaming: true, renameName: 'work', confirming: false }
		});

		expect(screen.getByDisplayValue('work')).toBeInTheDocument();
	});

	it('calls onrenameinput with new value when rename input changes', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onrenameinput = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				note,
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
				note,
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
				note,
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
				note,
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
			props: { folder: 'work', note, renaming: false, renameName: '', confirming: true }
		});

		expect(screen.getByText(/delete/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
	});

	it('calls onconfirmdelete when Confirm is clicked', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onconfirmdelete = vi.fn();
		render(FolderPanel, {
			props: {
				folder: 'work',
				note,
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
				note,
				renaming: false,
				renameName: '',
				confirming: true,
				oncanceldelete
			}
		});

		fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

		expect(oncanceldelete).toHaveBeenCalledOnce();
	});

	it('renders a textarea with the note content', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const n = createTestNote({ path: 'work/index.md', content: 'my notes here' });
		render(FolderPanel, {
			props: { folder: 'work', note: n, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByRole('textbox')).toHaveValue('my notes here');
	});

	it('renders an empty textarea when note is null', async () => {
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		render(FolderPanel, {
			props: { folder: 'work', note: null, renaming: false, renameName: '', confirming: false }
		});

		expect(screen.getByRole('textbox')).toHaveValue('');
	});

	it('calls onsave 800ms after typing stops', async () => {
		vi.useFakeTimers();
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onsave = vi.fn();
		const n = createTestNote({ path: 'work/index.md', content: '' });
		render(FolderPanel, {
			props: { folder: 'work', note: n, renaming: false, renameName: '', confirming: false, onsave }
		});

		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'hello world' } });
		expect(onsave).not.toHaveBeenCalled();

		vi.advanceTimersByTime(800);
		expect(onsave).toHaveBeenCalledWith('hello world');

		vi.useRealTimers();
	});

	it('debounces rapid typing — only calls onsave once', async () => {
		vi.useFakeTimers();
		const { default: FolderPanel } = await import('$lib/components/FolderPanel.svelte');
		const onsave = vi.fn();
		const n = createTestNote({ path: 'work/index.md', content: '' });
		render(FolderPanel, {
			props: { folder: 'work', note: n, renaming: false, renameName: '', confirming: false, onsave }
		});

		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'h' } });
		vi.advanceTimersByTime(400);
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'hello' } });
		vi.advanceTimersByTime(800);

		expect(onsave).toHaveBeenCalledTimes(1);
		expect(onsave).toHaveBeenCalledWith('hello');

		vi.useRealTimers();
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
