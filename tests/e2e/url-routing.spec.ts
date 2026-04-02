import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

interface MockFile {
	path: string;
	content: string;
	sha: string;
}

async function mockGitHub(page: Page, files: MockFile[] = []) {
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
			const urlObj = new URL(url);
			const filePath = urlObj.pathname.split('/contents/')[1];
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
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ content: { sha: 'created-sha' } })
			});
		}
		if (method === 'DELETE') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
}

async function setupApp(page: Page, files: MockFile[] = []) {
	await mockGitHub(page, files);
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

test.describe('URL routing', () => {
	test('selecting a folder updates the URL', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);
		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();
		await expect(page).toHaveURL(/\/inbox/);
	});

	test('refresh at a folder URL restores the selected folder', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);
		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();
		await expect(page).toHaveURL(/\/inbox/);

		await page.reload();
		await page.waitForURL(/\/inbox/, { timeout: 10_000 });
		await expect(page.locator('.loading'))
			.not.toBeVisible({ timeout: 5000 })
			.catch(() => {});
		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible({ timeout: 5000 });
	});

	test('navigating to an unknown folder URL redirects to root', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);
		await page.goto('/does-not-exist');
		await page.waitForURL('/', { timeout: 10_000 });
		await expect(page.getByText(/select a folder or create one/i)).toBeVisible();
	});

	test('back button returns to the previous folder', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'gk-1' },
			{ path: 'work/index.md', content: '', sha: 'gk-2' }
		]);

		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();
		await expect(page).toHaveURL(/\/inbox/);

		await page.locator('[data-folder]').filter({ hasText: 'work' }).click();
		await expect(page).toHaveURL(/\/work/);

		await page.goBack();
		await expect(page).toHaveURL(/\/inbox/);
		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible();
	});
});
