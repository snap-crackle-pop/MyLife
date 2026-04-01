import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

async function mockGitHub(
	page: Page,
	files: { path: string; content: string; sha: string }[] = []
) {
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
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ content: { sha: 'new-sha' } })
			});
		}

		if (method === 'DELETE') {
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		}

		return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
}

async function setupApp(page: Page, files: { path: string; content: string; sha: string }[] = []) {
	await mockGitHub(page, files);
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
	await page.fill('input[type="password"]', 'fake-token');
	await page.fill('input[type="text"]', REPO);
	await page.getByRole('button', { name: /connect/i }).click();
	await page.waitForURL('/', { timeout: 10_000 });
}

test.describe('sub-folder support', () => {
	test('sub-folders appear indented under their parent in the sidebar', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await expect(page.locator('[data-folder="work"]')).toBeVisible();
		await expect(page.locator('[data-folder="work/projects"]')).toBeVisible();
	});

	test('clicking a sub-folder in the sidebar shows its folder panel', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await page.locator('[data-folder="work/projects"]').click();

		await expect(page.getByRole('heading', { name: 'projects' })).toBeVisible();
	});

	test('sub-folder panel does not show add sub-folder button', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await page.locator('[data-folder="work/projects"]').click();

		await expect(page.getByRole('button', { name: 'Add sub-folder' })).not.toBeVisible();
	});

	test('top-level folder panel shows add sub-folder button', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();

		await expect(page.getByRole('button', { name: 'Add sub-folder' })).toBeVisible();
	});

	test('creating a sub-folder from the panel adds it to the sidebar', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.getByRole('button', { name: 'Add sub-folder' }).click();

		const input = page.locator('.subfolder-input');
		await expect(input).toBeVisible();
		await input.fill('archive');
		await input.press('Enter');

		await expect(page.locator('[data-folder="work/archive"]')).toBeVisible();
	});

	test('after creating a sub-folder, its panel is selected', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.getByRole('button', { name: 'Add sub-folder' }).click();

		await page.locator('.subfolder-input').fill('archive');
		await page.locator('.subfolder-input').press('Enter');

		await expect(page.getByRole('heading', { name: 'archive' })).toBeVisible();
	});

	test('cancelling sub-folder input with Escape does not create a folder', async ({ page }) => {
		await setupApp(page, [{ path: 'work/.gitkeep', content: '', sha: 'sha1' }]);

		await page.locator('[data-folder="work"]').click();
		await page.getByRole('button', { name: 'Add sub-folder' }).click();

		await page.locator('.subfolder-input').fill('archive');
		await page.locator('.subfolder-input').press('Escape');

		await expect(page.locator('.subfolder-input')).not.toBeVisible();
		await expect(page.locator('[data-folder="work/archive"]')).not.toBeVisible();
	});

	test('renaming a sub-folder keeps it under the same parent', async ({ page }) => {
		await setupApp(page, [
			{ path: 'work/.gitkeep', content: '', sha: 'sha1' },
			{ path: 'work/projects/.gitkeep', content: '', sha: 'sha2' }
		]);

		await page.locator('[data-folder="work/projects"]').click();
		await page.getByRole('button', { name: 'Rename' }).click();

		const input = page.locator('.rename-input');
		await input.fill('archive');
		await input.press('Enter');

		await expect(page.locator('[data-folder="work/archive"]')).toBeVisible();
		await expect(page.locator('[data-folder="archive"]')).not.toBeVisible();
	});
});
