// src/mocks/browser-handlers.ts
import { http, HttpResponse } from 'msw';

interface MockFile {
	path: string;
	content: string;
	sha: string;
}

function getFixtures(): MockFile[] {
	return (window as unknown as { __mswFixtures?: MockFile[] }).__mswFixtures ?? [];
}

export const browserHandlers = [
	// listFiles
	http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () => {
		const files = getFixtures();
		return HttpResponse.json({
			tree: files.map((f) => ({ path: f.path, type: 'blob', sha: f.sha }))
		});
	}),

	// getFileContent
	http.get('https://api.github.com/repos/:owner/:repo/contents/*', ({ request }) => {
		const files = getFixtures();
		const path = new URL(request.url).pathname.split('/contents/')[1];
		const file = files.find((f) => f.path === path);
		if (!file) return new HttpResponse(null, { status: 404 });
		return HttpResponse.json({ content: btoa(file.content), sha: file.sha });
	}),

	// createFile / updateFile
	http.put('https://api.github.com/repos/:owner/:repo/contents/*', () =>
		HttpResponse.json({ content: { sha: 'mock-sha' } })
	),

	// deleteFile
	http.delete('https://api.github.com/repos/:owner/:repo/contents/*', () => HttpResponse.json({})),

	// validateConnection
	http.get('https://api.github.com/repos/:owner/:repo', () => HttpResponse.json({}))
];
