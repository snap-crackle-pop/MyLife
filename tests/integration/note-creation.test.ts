import { describe, it, expect } from 'vitest';
import { createSlug, buildFolderTree } from '$lib/stores/notes.svelte';

describe('createSlug', () => {
	it('converts title to lowercase hyphenated slug', () => {
		expect(createSlug('My Cool Note')).toBe('my-cool-note');
	});

	it('strips special characters', () => {
		expect(createSlug('Hello, World! #1')).toBe('hello-world-1');
	});

	it('trims leading/trailing hyphens', () => {
		expect(createSlug('  --hello--  ')).toBe('hello');
	});

	it('collapses multiple hyphens', () => {
		expect(createSlug('foo   bar')).toBe('foo-bar');
	});
});

describe('buildFolderTree', () => {
	it('builds tree from note paths', () => {
		const paths = [
			'inbox/note1.md',
			'inbox/note2.md',
			'work/project/deep.md',
			'work/task.md',
			'daily/2026-03-29.md'
		];

		const tree = buildFolderTree(paths);

		expect(tree.map((f) => f.name)).toContain('inbox');
		expect(tree.map((f) => f.name)).toContain('work');
		expect(tree.map((f) => f.name)).toContain('daily');

		const work = tree.find((f) => f.name === 'work')!;
		expect(work.children).toHaveLength(1);
		expect(work.children[0].name).toBe('project');
	});

	it('returns empty array for no paths', () => {
		expect(buildFolderTree([])).toEqual([]);
	});

	it('sorts folders alphabetically', () => {
		const tree = buildFolderTree(['zebra/a.md', 'alpha/b.md']);
		expect(tree[0].name).toBe('alpha');
		expect(tree[1].name).toBe('zebra');
	});

	it('always puts .trash last regardless of alphabetical order', () => {
		const tree = buildFolderTree(['.trash/old.md', 'alpha/a.md', 'zebra/b.md']);
		expect(tree[tree.length - 1].name).toBe('.trash');
	});
});
