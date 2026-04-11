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

test.describe('Star folders', () => {
	test('star button appears in folder panel header', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);
		await page.locator('[data-folder="inbox"]').click();
		await expect(page.getByRole('button', { name: 'Star folder' })).toBeVisible();
	});

	test('star button fills when clicked and sidebar shows indicator', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);
		await page.locator('[data-folder="inbox"]').click();

		await page.getByRole('button', { name: 'Star folder' }).click();

		// Button label changes to Unstar
		await expect(page.getByRole('button', { name: 'Unstar folder' })).toBeVisible();

		// Star indicator appears on folder in sidebar
		const folderItem = page.locator('[data-folder="inbox"]').locator('..');
		await expect(folderItem.locator('.folder-star')).toBeVisible();
	});

	test('star filter button shows only starred folders', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/index.md', content: '', sha: 'sha-2' }
		]);

		// Star inbox
		await page.locator('[data-folder="inbox"]').click();
		await page.getByRole('button', { name: 'Star folder' }).click();

		// Activate star filter
		await page.getByRole('button', { name: 'Show starred folders' }).click();

		// Only inbox is visible
		await expect(page.locator('[data-folder="inbox"]')).toBeVisible();
		await expect(page.locator('[data-folder="work"]')).not.toBeVisible();
	});

	test('disabling star filter shows all folders again', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/index.md', content: '', sha: 'sha-2' }
		]);

		await page.locator('[data-folder="inbox"]').click();
		await page.getByRole('button', { name: 'Star folder' }).click();

		await page.getByRole('button', { name: 'Show starred folders' }).click();
		await page.getByRole('button', { name: 'Show all folders' }).click();

		await expect(page.locator('[data-folder="inbox"]')).toBeVisible();
		await expect(page.locator('[data-folder="work"]')).toBeVisible();
	});

	test('starring a subfolder shows parent and subfolder when filter is active', async ({
		page
	}) => {
		await setupApp(page, [
			{ path: 'work/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/projects/index.md', content: '', sha: 'sha-2' },
			{ path: 'inbox/index.md', content: '', sha: 'sha-3' }
		]);

		// Navigate to the subfolder and star it
		await page.locator('[data-folder="work/projects"]').click();
		await page.getByRole('button', { name: 'Star folder' }).click();

		// Activate star filter
		await page.getByRole('button', { name: 'Show starred folders' }).click();

		// Parent (work) and subfolder (projects) are visible
		await expect(page.locator('[data-folder="work"]')).toBeVisible();
		await expect(page.locator('[data-folder="work/projects"]')).toBeVisible();

		// Unrelated folder (inbox) is hidden
		await expect(page.locator('[data-folder="inbox"]')).not.toBeVisible();
	});
});
