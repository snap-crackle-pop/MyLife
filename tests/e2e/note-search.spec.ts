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

test.describe('Folder name filter', () => {
	test('typing in the search input filters folders by name', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/index.md', content: '', sha: 'sha-2' },
			{ path: 'personal/index.md', content: '', sha: 'sha-3' }
		]);

		await page.locator('.search-input').fill('wo');

		await expect(page.locator('[data-folder="work"]')).toBeVisible();
		await expect(page.locator('[data-folder="inbox"]')).not.toBeVisible();
		await expect(page.locator('[data-folder="personal"]')).not.toBeVisible();
	});

	test('clearing the search input shows all folders', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'sha-1' },
			{ path: 'work/index.md', content: '', sha: 'sha-2' }
		]);

		await page.locator('.search-input').fill('wo');
		await expect(page.locator('[data-folder="inbox"]')).not.toBeVisible();

		await page.locator('.search-input').fill('');

		await expect(page.locator('[data-folder="inbox"]')).toBeVisible();
		await expect(page.locator('[data-folder="work"]')).toBeVisible();
	});
});

test.describe('Note content search', () => {
	test('clicking search button activates content search mode', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);

		await expect(page.locator('.search-input')).toHaveAttribute(
			'placeholder',
			'Search folders…'
		);

		await page.getByRole('button', { name: 'Search notes' }).click();

		await expect(page.locator('.search-input')).toHaveAttribute(
			'placeholder',
			'Search notes…'
		);
	});

	test('content search shows folders whose notes match the query', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: 'buy milk and eggs', sha: 'sha-1' },
			{ path: 'work/index.md', content: 'quarterly report', sha: 'sha-2' }
		]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await page.locator('.search-input').fill('milk');

		await expect(page.locator('[data-folder="inbox"]')).toBeVisible();
		await expect(page.locator('[data-folder="work"]')).not.toBeVisible();
	});

	test('content search shows a snippet of the matching text', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: 'buy milk and eggs', sha: 'sha-1' }
		]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await page.locator('.search-input').fill('milk');

		await expect(page.locator('.result-match')).toHaveText('milk');
	});

	test('content search shows total match count', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: 'milk milk milk', sha: 'sha-1' }
		]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await page.locator('.search-input').fill('milk');

		await expect(page.locator('.search-count')).toContainText('3');
	});

	test('content search with no matches shows no results message', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: 'buy milk and eggs', sha: 'sha-1' }
		]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await page.locator('.search-input').fill('unicorn');

		await expect(page.locator('.search-count')).toContainText('No results');
	});

	test('clicking a search result navigates to that folder', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: 'remember to call dentist', sha: 'sha-1' }
		]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await page.locator('.search-input').fill('dentist');

		await page.locator('[data-folder="inbox"]').click();

		await expect(page).toHaveURL(/\/inbox/);
		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible();
	});

	test('pressing Escape exits content search mode', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await expect(page.locator('.search-input')).toHaveAttribute('placeholder', 'Search notes…');

		await page.locator('.search-input').press('Escape');

		await expect(page.locator('.search-input')).toHaveAttribute(
			'placeholder',
			'Search folders…'
		);
	});

	test('clicking search button again exits content search mode', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'sha-1' }]);

		await page.getByRole('button', { name: 'Search notes' }).click();
		await expect(page.locator('.search-input')).toHaveAttribute('placeholder', 'Search notes…');

		await page.getByRole('button', { name: 'Search notes' }).click();

		await expect(page.locator('.search-input')).toHaveAttribute(
			'placeholder',
			'Search folders…'
		);
	});
});
