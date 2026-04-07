import { describe, it, expect } from 'vitest';
import { extractSnippet, countMatches } from '$lib/search';

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
