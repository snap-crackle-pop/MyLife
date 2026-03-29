import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SetupPage from '../../src/routes/setup/+page.svelte';
import { createMockFetch, githubError } from '../factories';

const mockFetch = createMockFetch();
vi.stubGlobal('fetch', mockFetch);

// Mock SvelteKit navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

describe('Setup Page', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('renders the setup form with token and repo fields', () => {
		render(SetupPage);

		expect(screen.getByText('MyLife')).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/ghp_/)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/username\//)).toBeInTheDocument();
	});

	it('disables connect button when fields are empty', () => {
		render(SetupPage);

		const button = screen.getByRole('button', { name: /connect/i });
		expect(button).toBeDisabled();
	});

	it('enables connect button when both fields are filled', async () => {
		const user = userEvent.setup();
		render(SetupPage);

		await user.type(screen.getByPlaceholderText(/ghp_/), 'ghp_test123');
		await user.type(screen.getByPlaceholderText(/username\//), 'user/repo');

		const button = screen.getByRole('button', { name: /connect/i });
		expect(button).not.toBeDisabled();
	});

	it('shows error message on failed connection', async () => {
		const user = userEvent.setup();
		mockFetch.mockResolvedValueOnce(githubError(401, 'Unauthorized'));

		render(SetupPage);

		await user.type(screen.getByPlaceholderText(/ghp_/), 'bad-token');
		await user.type(screen.getByPlaceholderText(/username\//), 'user/repo');
		await user.click(screen.getByRole('button', { name: /connect/i }));

		// Wait for error to appear
		expect(await screen.findByText(/GitHub API error/)).toBeInTheDocument();
	});
});
