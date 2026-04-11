import { test, expect, type Page } from '@playwright/test';

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO = 'testuser/mylife-notes';

interface MockFile {
	path: string;
	content: string;
	sha: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Complete the setup flow and land on the main page.
 * Going through /setup ensures the config is saved to IndexedDB via the real app code,
 * so subsequent navigations/reloads work correctly.
 */
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
	await page.goto('/'); // layout redirects to /setup when no config
	await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });

	await page.fill('input[type="password"]', 'fake-token');
	await page.fill('input[type="text"]', REPO);
	await page.getByRole('button', { name: /connect/i }).click();

	await page.waitForURL('/', { timeout: 10_000 });
	// Wait until the loading overlay is gone
	await expect(page.locator('.loading'))
		.not.toBeVisible({ timeout: 5000 })
		.catch(() => {
			// loading element may not exist at all — that's fine
		});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Setup', () => {
	test('redirects to setup page when no config is stored', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/setup/);
		await expect(page.getByText('Connect your GitHub repo')).toBeVisible();
	});
});

test.describe('Folder sidebar', () => {
	test('empty repo shows no folders and empty state', async ({ page }) => {
		await setupApp(page, []);
		await expect(page.locator('[data-folder]')).toHaveCount(0);
		await expect(page.getByText(/select a folder or create one/i)).toBeVisible();
	});

	test('folders from GitHub appear in the sidebar', async ({ page }) => {
		await setupApp(page, [
			{ path: 'inbox/index.md', content: '', sha: 'gk-1' },
			{ path: 'work/index.md', content: '', sha: 'gk-2' }
		]);

		await expect(page.locator('[data-folder]').filter({ hasText: 'inbox' })).toBeVisible();
		await expect(page.locator('[data-folder]').filter({ hasText: 'work' })).toBeVisible();
	});

	test('folders appear in load order', async ({ page }) => {
		await setupApp(page, [
			{ path: 'zebra/index.md', content: '', sha: 'gk-z' },
			{ path: 'alpha/index.md', content: '', sha: 'gk-a' },
			{ path: 'mango/index.md', content: '', sha: 'gk-m' }
		]);

		const items = page.locator('[data-folder]');
		await expect(items.nth(0)).toHaveText(/zebra/);
		await expect(items.nth(1)).toHaveText(/alpha/);
		await expect(items.nth(2)).toHaveText(/mango/);
	});
});

test.describe('Create folder', () => {
	test('creating a folder adds it to the sidebar immediately', async ({ page }) => {
		await setupApp(page, []);

		await page.getByRole('button', { name: /new folder/i }).click();
		const input = page.getByPlaceholder(/folder name/i);
		await input.fill('projects');
		await input.press('Enter');

		await expect(page.locator('[data-folder]').filter({ hasText: 'projects' })).toBeVisible();
	});

	test('pressing Escape cancels folder creation', async ({ page }) => {
		await setupApp(page, []);

		await page.getByRole('button', { name: /new folder/i }).click();
		const input = page.getByPlaceholder(/folder name/i);
		await input.fill('should-not-appear');
		await input.press('Escape');

		await expect(
			page.locator('[data-folder]').filter({ hasText: 'should-not-appear' })
		).toHaveCount(0);
	});
});

test.describe('Folder panel', () => {
	test('selecting a folder shows its panel with name', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/index.md', content: '', sha: 'gk' }]);

		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();

		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible();
	});

	test('empty folder shows textarea with placeholder', async ({ page }) => {
		await setupApp(page, [{ path: 'empty/index.md', content: '', sha: 'gk' }]);

		await page.locator('[data-folder]').filter({ hasText: 'empty' }).click();
		await expect(page.locator('.note-editor')).toBeVisible();
	});

	test('folder panel shows index.md content in textarea', async ({ page }) => {
		await setupApp(page, [{ path: 'ideas/index.md', content: 'My first idea', sha: 'sha-1' }]);

		await page.locator('[data-folder]').filter({ hasText: 'ideas' }).click();
		await expect(page.locator('.note-editor')).toHaveValue('My first idea');
	});
});

test.describe('Rename folder', () => {
	test('renaming updates sidebar and panel heading', async ({ page }) => {
		await setupApp(page, [{ path: 'old-name/index.md', content: '', sha: 'gk' }]);

		await page.locator('[data-folder]').filter({ hasText: 'old-name' }).click();
		await page.getByRole('button', { name: /rename/i }).click();

		const input = page.locator('.rename-input');
		await input.fill('new-name');
		await input.press('Enter');

		await expect(page.locator('[data-folder]').filter({ hasText: 'new-name' })).toBeVisible();
		await expect(page.locator('[data-folder]').filter({ hasText: 'old-name' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'new-name' })).toBeVisible();
	});
});

test.describe('Delete folder', () => {
	test('deleting empty folder removes it from sidebar and shows empty state', async ({ page }) => {
		await setupApp(page, [{ path: 'temp/index.md', content: '', sha: 'gk' }]);

		await page.locator('[data-folder]').filter({ hasText: 'temp' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await page.getByRole('button', { name: /confirm/i }).click();

		await expect(page.locator('[data-folder]').filter({ hasText: 'temp' })).toHaveCount(0);
		await expect(page.getByText(/select a folder or create one/i)).toBeVisible();
	});

	test('deleting folder shows confirmation dialog', async ({ page }) => {
		await setupApp(page, [{ path: 'to-delete/index.md', content: '', sha: 'gk' }]);

		await page.locator('[data-folder]').filter({ hasText: 'to-delete' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect(page.locator('.confirm-msg')).toContainText('to-delete');
		await expect(page.getByRole('button', { name: /confirm/i })).toBeVisible();
	});

	test('confirming delete removes folder and shows empty state', async ({ page }) => {
		await setupApp(page, [
			{ path: 'bye/index.md', content: '', sha: 'gk' },
			{ path: 'bye/note.md', content: 'Farewell note', sha: 'sha-n' }
		]);

		await page.locator('[data-folder]').filter({ hasText: 'bye' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await page.getByRole('button', { name: /confirm/i }).click();

		await expect(page.locator('[data-folder]').filter({ hasText: 'bye' })).toHaveCount(0);
		await expect(page.getByText(/select a folder or create one/i)).toBeVisible();
	});

	test('cancelling delete leaves folder intact', async ({ page }) => {
		await setupApp(page, [{ path: 'keep-me/index.md', content: '', sha: 'gk' }]);

		await page.locator('[data-folder]').filter({ hasText: 'keep-me' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await page.getByRole('button', { name: /cancel/i }).click();

		await expect(page.locator('[data-folder]').filter({ hasText: 'keep-me' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'keep-me' })).toBeVisible();
	});
});

test.describe('Persistence', () => {
	test('folders persist across page reload (loaded from cache)', async ({ page }) => {
		await setupApp(page, [{ path: 'saved/index.md', content: '', sha: 'gk' }]);

		// Verify folder is shown
		await expect(page.locator('[data-folder]').filter({ hasText: 'saved' })).toBeVisible();

		// Reload — routes are still active, cache is pre-populated
		await page.reload();
		await page.waitForURL('/');

		// Folder should still appear (from cache, before GitHub responds)
		await expect(page.locator('[data-folder]').filter({ hasText: 'saved' })).toBeVisible();
	});
});
