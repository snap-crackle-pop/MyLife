import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Sidebar from '$lib/components/Sidebar.svelte';
import { createTestFolder } from '../factories';

const work = createTestFolder({
	path: 'work',
	name: 'work',
	children: [
		createTestFolder({ path: 'work/notes', name: 'notes' }),
		createTestFolder({ path: 'work/archive', name: 'archive' })
	]
});

const personal = createTestFolder({
	path: 'personal',
	name: 'personal',
	children: [createTestFolder({ path: 'personal/journal', name: 'journal' })]
});

const folders = [work, personal];

describe('Sidebar folder search', () => {
	it('shows all folders when search is empty', () => {
		render(Sidebar, { props: { folders, selectedFolder: null } });
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^personal$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^notes$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^archive$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^journal$/ })).toBeInTheDocument();
	});

	it('filters to matching top-level folder and hides its children', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null } });
		await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
			target: { value: 'work' }
		});
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^notes$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^archive$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('shows parent as container with only matching children when parent does not match', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null } });
		await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
			target: { value: 'notes' }
		});
		// Parent shown as container
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		// Only matching child shown
		expect(screen.getByRole('button', { name: /^notes$/ })).toBeInTheDocument();
		// Non-matching child hidden
		expect(screen.queryByRole('button', { name: /^archive$/ })).not.toBeInTheDocument();
		// Unrelated folder hidden
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('shows empty list when nothing matches', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null } });
		await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
			target: { value: 'zzz' }
		});
		expect(screen.queryByRole('button', { name: /^work$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('is case-insensitive', async () => {
		render(Sidebar, { props: { folders, selectedFolder: null } });
		await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
			target: { value: 'WORK' }
		});
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();
	});

	it('resets search when sidebar closes', async () => {
		const { rerender } = render(Sidebar, {
			props: { folders, selectedFolder: null, isOpen: true }
		});
		await fireEvent.input(screen.getByPlaceholderText('Search folders…'), {
			target: { value: 'work' }
		});
		// personal is hidden
		expect(screen.queryByRole('button', { name: /^personal$/ })).not.toBeInTheDocument();

		// Simulate sidebar closing (e.g. backdrop tap)
		await rerender({ isOpen: false });

		// After close, search is reset — all folders visible again
		expect(screen.getByRole('button', { name: /^work$/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^personal$/ })).toBeInTheDocument();
	});
});
