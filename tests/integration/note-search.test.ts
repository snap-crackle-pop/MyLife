import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { vi } from 'vitest';
import { extractSnippet, countMatches } from '$lib/search';
import Sidebar from '$lib/components/Sidebar.svelte';
import { createTestNote } from '../factories';
import type { Note } from '$lib/types';

describe('extractSnippet', () => {
	it('returns before, match, and after parts', () => {
		const result = extractSnippet('hello world foo bar', 'world');
		expect(result.before).toBe('hello ');
		expect(result.match).toBe('world');
		expect(result.after).toBe(' foo bar');
	});

	it('preserves original casing of matched text', () => {
		const result = extractSnippet('Hello World', 'world');
		expect(result.match).toBe('World');
	});

	it('truncates long content to ~60 chars before and after the match', () => {
		const longBefore = 'a'.repeat(100);
		const longAfter = 'b'.repeat(100);
		const result = extractSnippet(`${longBefore}MATCH${longAfter}`, 'match');
		expect(result.before.length).toBeLessThanOrEqual(62); // 60 chars + optional ellipsis
		expect(result.after.length).toBeLessThanOrEqual(62);
		expect(result.match).toBe('MATCH');
	});

	it('returns empty before/match and content as after when query not found', () => {
		const result = extractSnippet('hello world', 'nothere');
		expect(result.before).toBe('');
		expect(result.match).toBe('');
		expect(result.after).toBe('hello world');
	});
});

describe('countMatches', () => {
	it('counts all non-overlapping occurrences', () => {
		expect(countMatches('foo foo foo', 'foo')).toBe(3);
	});

	it('is case-insensitive', () => {
		expect(countMatches('Foo FOO foo', 'foo')).toBe(3);
	});

	it('returns 0 when there are no matches', () => {
		expect(countMatches('hello world', 'nothere')).toBe(0);
	});

	it('counts non-overlapping matches only', () => {
		expect(countMatches('aaa', 'aa')).toBe(1);
	});
});

const notes: Note[] = [
	createTestNote({
		path: 'journal/index.md',
		content: 'Hello world, this is my journal entry about foo'
	}),
	createTestNote({
		path: 'work/index.md',
		content: 'Work notes about project management and deadlines'
	}),
	createTestNote({
		path: 'recipes/index.md',
		content: 'My favorite recipe: chocolate cake with foo topping'
	})
];

const defaultProps = {
	folders: [],
	selectedFolder: null,
	notes
};

describe('Sidebar search mode', () => {
	it('shows Search notes placeholder after clicking the search button', async () => {
		render(Sidebar, defaultProps);
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		expect(screen.getByPlaceholderText('Search notes…')).toBeInTheDocument();
	});

	it('shows matching notes when a query is entered', async () => {
		render(Sidebar, defaultProps);
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'foo' }
		});
		expect(screen.getByText('journal')).toBeInTheDocument();
		expect(screen.getByText('recipes')).toBeInTheDocument();
		expect(screen.queryByText('work')).not.toBeInTheDocument();
	});

	it('shows match count below the input', async () => {
		render(Sidebar, defaultProps);
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'foo' }
		});
		expect(screen.getByText('2 matches in 2 notes')).toBeInTheDocument();
	});

	it('shows No results when query has no matches', async () => {
		render(Sidebar, defaultProps);
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'xyznotexist' }
		});
		expect(screen.getByText('No results')).toBeInTheDocument();
	});

	it('is case-insensitive', async () => {
		render(Sidebar, defaultProps);
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'FOO' }
		});
		expect(screen.getByText('journal')).toBeInTheDocument();
		expect(screen.getByText('recipes')).toBeInTheDocument();
	});

	it('calls onselectfolder with the folder path when a result is clicked', async () => {
		const onselectfolder = vi.fn();
		render(Sidebar, { ...defaultProps, onselectfolder });
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'foo' }
		});
		const journalResult = document.querySelector('[data-folder="journal"]') as HTMLElement;
		await fireEvent.click(journalResult);
		expect(onselectfolder).toHaveBeenCalledWith('journal');
	});

	it('restores Search folders placeholder when search mode is toggled off', async () => {
		render(Sidebar, defaultProps);
		const searchBtn = screen.getByRole('button', { name: 'Search notes' });
		await fireEvent.click(searchBtn);
		expect(screen.getByPlaceholderText('Search notes…')).toBeInTheDocument();
		await fireEvent.click(searchBtn);
		expect(screen.getByPlaceholderText('Search folders…')).toBeInTheDocument();
	});

	it('shows each folder only once even if multiple notes match', async () => {
		const multiNotes: Note[] = [
			createTestNote({ path: 'journal/index.md', content: 'foo bar' }),
			createTestNote({ path: 'journal/entry.md', content: 'foo baz' }),
			createTestNote({ path: 'work/index.md', content: 'no match here' })
		];
		render(Sidebar, { folders: [], selectedFolder: null, notes: multiNotes });
		await fireEvent.click(screen.getByRole('button', { name: 'Search notes' }));
		await fireEvent.input(screen.getByPlaceholderText('Search notes…'), {
			target: { value: 'foo' }
		});
		const journalResults = document.querySelectorAll('[data-folder="journal"]');
		expect(journalResults.length).toBe(1);
	});
});
