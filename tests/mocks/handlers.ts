// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
	// listFiles — returns an empty tree by default
	http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () => {
		return HttpResponse.json({ tree: [] });
	}),

	// getFileContent — returns empty content by default
	http.get('https://api.github.com/repos/:owner/:repo/contents/*', () => {
		return HttpResponse.json({ content: btoa(''), sha: 'default-sha' });
	}),

	// createFile / updateFile
	http.put('https://api.github.com/repos/:owner/:repo/contents/*', () => {
		return HttpResponse.json({ content: { sha: 'mock-sha' } });
	}),

	// deleteFile
	http.delete('https://api.github.com/repos/:owner/:repo/contents/*', () => {
		return HttpResponse.json({});
	}),

	// validateConnection
	http.get('https://api.github.com/repos/:owner/:repo', () => {
		return HttpResponse.json({});
	})
];
