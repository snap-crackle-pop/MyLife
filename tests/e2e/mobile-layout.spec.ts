import { test, expect, type Page } from '@playwright/test';

const REPO = 'testuser/mylife-notes';

interface MockFile {
	path: string;
	content: string;
	sha: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
		.catch(() => {
			// loading element may not exist at all — that's fine
		});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('mobile layout', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('sidebar is hidden and hamburger is visible on load', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

		const nav = page.getByRole('navigation');
		const hamburger = page.getByRole('button', { name: 'Open folders' });

		// Hamburger visible
		await expect(hamburger).toBeVisible();

		// Sidebar translated off-screen (not visually visible)
		// The nav exists in DOM but has transform: translateX(-100%)
		await expect(nav).not.toBeInViewport();
	});

	test('hamburger opens the sidebar drawer', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();

		const nav = page.getByRole('navigation');
		await expect(nav).toBeInViewport();
		await expect(page.locator('[data-folder]').filter({ hasText: 'inbox' })).toBeVisible();
	});

	test('close button inside drawer closes the sidebar', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await expect(page.getByRole('navigation')).toBeInViewport();

		await page.getByRole('button', { name: 'Close folders' }).click();
		await expect(page.getByRole('navigation')).not.toBeInViewport();
	});

	test('selecting a folder closes the drawer', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'inbox' }).click();

		await expect(page.getByRole('navigation')).not.toBeInViewport();
		// Folder panel heading is visible
		await expect(page.getByRole('heading', { name: 'inbox' })).toBeVisible();
	});

	test('backdrop tap closes the drawer', async ({ page }) => {
		await setupApp(page, [{ path: 'inbox/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await expect(page.getByRole('navigation')).toBeInViewport();

		// Click the backdrop (right side of screen, outside drawer width of 280px)
		await page.mouse.click(350, 400);
		await expect(page.getByRole('navigation')).not.toBeInViewport();
	});

	test('mobile header shows folder name when folder is selected', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		// Folder name appears in header bar (not "MyLife")
		const heading = page.getByRole('heading', { name: 'journal' });
		await expect(heading).toBeVisible();
		await expect(page.locator('.app-title').filter({ hasText: 'MyLife' })).not.toBeVisible();
	});

	test('mobile header shows rename and delete icon buttons when folder is selected', async ({
		page
	}) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
	});

	test('tapping rename icon shows inline input in mobile header', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Rename' }).click();

		// Rename input appears in header with current folder name pre-filled
		const input = page.locator('.mobile-rename-input');
		await expect(input).toBeVisible();
		await expect(input).toHaveValue('journal');

		// Confirm and cancel icons appear
		await expect(page.getByRole('button', { name: 'Confirm rename' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel rename' })).toBeVisible();
	});

	test('confirming rename updates the folder name in mobile header', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Rename' }).click();

		const input = page.locator('.mobile-rename-input');
		await input.fill('diary');
		await input.press('Enter');

		// Header shows new name
		await expect(page.getByRole('heading', { name: 'diary' })).toBeVisible();
	});

	test('tapping delete icon shows confirm bar', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Delete' }).click();

		// Confirm bar appears below header
		await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

		// Folder name still visible in header (not icons)
		await expect(page.getByRole('heading', { name: 'journal' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Rename' })).not.toBeVisible();
	});

	test('cancelling delete restores rename and delete buttons in header', async ({ page }) => {
		await setupApp(page, [{ path: 'journal/.gitkeep', content: '', sha: 'sha1' }]);

		await page.getByRole('button', { name: 'Open folders' }).click();
		await page.locator('[data-folder]').filter({ hasText: 'journal' }).click();

		await page.getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Cancel', exact: true }).click();

		// Rename and Delete buttons reappear
		await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
	});
});
