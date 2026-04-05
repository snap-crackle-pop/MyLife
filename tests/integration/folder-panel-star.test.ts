import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FolderPanel from '$lib/components/FolderPanel.svelte';

const baseProps = {
	folder: 'inbox',
	note: null,
	renaming: false,
	renameName: '',
	confirming: false
};

describe('FolderPanel star button', () => {
	it('renders a "Star folder" button when not starred', () => {
		render(FolderPanel, { props: { ...baseProps, starred: false, ontogglestar: vi.fn() } });
		expect(screen.getByRole('button', { name: 'Star folder' })).toBeInTheDocument();
	});

	it('renders an "Unstar folder" button when starred', () => {
		render(FolderPanel, { props: { ...baseProps, starred: true, ontogglestar: vi.fn() } });
		expect(screen.getByRole('button', { name: 'Unstar folder' })).toBeInTheDocument();
	});

	it('calls ontogglestar when star button is clicked', async () => {
		const ontogglestar = vi.fn();
		render(FolderPanel, { props: { ...baseProps, starred: false, ontogglestar } });
		await fireEvent.click(screen.getByRole('button', { name: 'Star folder' }));
		expect(ontogglestar).toHaveBeenCalledOnce();
	});

	it('star button is not shown while renaming', () => {
		render(FolderPanel, {
			props: {
				...baseProps,
				starred: false,
				ontogglestar: vi.fn(),
				renaming: true,
				renameName: 'inbox'
			}
		});
		expect(screen.queryByRole('button', { name: 'Star folder' })).not.toBeInTheDocument();
	});

	it('star button is not shown while confirming delete', () => {
		render(FolderPanel, {
			props: { ...baseProps, starred: false, ontogglestar: vi.fn(), confirming: true }
		});
		expect(screen.queryByRole('button', { name: 'Star folder' })).not.toBeInTheDocument();
	});
});
