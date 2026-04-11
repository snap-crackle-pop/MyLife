import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import SetupPage from '../../src/routes/setup/+page.svelte';

// Mock SvelteKit navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

describe('Setup Page', () => {
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
		server.use(
			http.get(
				'https://api.github.com/repos/:owner/:repo',
				() => new HttpResponse(null, { status: 401, statusText: 'Unauthorized' })
			)
		);

		render(SetupPage);

		await user.type(screen.getByPlaceholderText(/ghp_/), 'bad-token');
		await user.type(screen.getByPlaceholderText(/username\//), 'user/repo');
		await user.click(screen.getByRole('button', { name: /connect/i }));

		expect(await screen.findByText(/GitHub API error/)).toBeInTheDocument();
	});
});
