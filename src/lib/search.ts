export function extractSnippet(
	content: string,
	query: string
): { before: string; match: string; after: string } {
	const lowerContent = content.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const idx = lowerContent.indexOf(lowerQuery);

	if (idx === -1) {
		return { before: '', match: '', after: content.slice(0, 120) };
	}

	const matchStr = content.slice(idx, idx + query.length);
	const beforeStart = Math.max(0, idx - 20);
	const afterEnd = Math.min(content.length, idx + query.length + 80);

	const before =
		(beforeStart > 0 ? '…' : '') + content.slice(beforeStart, idx).replace(/\s+/g, ' ');
	const after =
		content.slice(idx + query.length, afterEnd).replace(/\s+/g, ' ') +
		(afterEnd < content.length ? '…' : '');

	return { before, match: matchStr, after };
}

export function countMatches(content: string, query: string): number {
	const lower = content.toLowerCase();
	const lq = query.toLowerCase();
	let count = 0;
	let pos = 0;
	while (true) {
		const idx = lower.indexOf(lq, pos);
		if (idx === -1) break;
		count++;
		pos = idx + lq.length;
	}
	return count;
}
