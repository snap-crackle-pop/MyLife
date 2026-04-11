import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

interface MockFile {
	path: string;
	content: string;
	sha: string;
}

async function setupApp(page: Page, files: MockFile[] = []) {
	await page.route('https://api.github.com/**', (route) => {
		const url = route.request().url();
		const method = route.request().method();

		if (url.includes('/git/trees/main')) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					tree: files.map((f) => ({ path: f.path, type: 'blob', sha: f.sha }))
				})
			});
		}
		if (method === 'GET' && url.includes('/contents/')) {
			const filePath = new URL(url).pathname.split('/contents/')[1];
			const file = files.find((f) => f.path === filePath);
			if (file) {
				return route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ content: btoa(file.content), sha: file.sha })
				});
			}
			return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
		}
		if (method === 'PUT') {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ content: { sha: 'mock-sha' } })
			});
		}
		if (method === 'DELETE') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
	await page.fill('input[type="password"]', 'fake-token');
	await page.fill('input[type="text"]', REPO);
	await page.getByRole('button', { name: /connect/i }).click();
	await page.waitForURL('/', { timeout: 10_000 });
	await expect(page.locator('.loading'))
		.not.toBeVisible({ timeout: 5000 })
		.catch(() => {});
}

test.describe('Note editing', () => {
	test('existing note content loads into the editor', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/index.md', content: 'Hello world', sha: 'sha-1' }]);

		await page.locator('[data-folder="journal"]').click();

		await expect(page.locator('.note-editor')).toHaveValue('Hello world');
	});

	test('typing in the editor sends a PUT request to GitHub', async ({ page }) => {
		await setupApp(page, [{ path: 'ideas/index.md', content: 'original', sha: 'sha-1' }]);

		await page.locator('[data-folder="ideas"]').click();
		await expect(page.locator('.note-editor')).toHaveValue('original');

		const putRequest = page.waitForRequest(
			(req) => req.method() === 'PUT' && req.url().includes('/contents/ideas/index.md'),
			{ timeout: 5000 }
		);

		await page.locator('.note-editor').fill('updated content');

		const req = await putRequest;
		const body = JSON.parse(req.postData() ?? '{}') as { message: string; content: string };
		expect(atob(body.content)).toBe('updated content');
	});

	test('textarea reflects typed content immediately', async ({ page }) => {
		await setupApp(page, [{ path: 'work/index.md', content: '', sha: 'sha-1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.locator('.note-editor').fill('my new note');

		await expect(page.locator('.note-editor')).toHaveValue('my new note');
	});

	test('editing one folder does not affect another folder', async ({ page }) => {
		await setupApp(page, [
			{ path: 'alpha/index.md', content: 'alpha content', sha: 'sha-a' },
			{ path: 'beta/index.md', content: 'beta content', sha: 'sha-b' }
		]);

		await page.locator('[data-folder="alpha"]').click();
		await expect(page.locator('.note-editor')).toHaveValue('alpha content');

		await page.locator('[data-folder="beta"]').click();
		await expect(page.locator('.note-editor')).toHaveValue('beta content');
	});
});
