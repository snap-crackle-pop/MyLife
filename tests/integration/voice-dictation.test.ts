import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import FolderPanel from '$lib/components/FolderPanel.svelte';
import { createTestNote } from '../factories';

// ── Mock SpeechRecognition ────────────────────────────────────────────────────

interface MockInstance {
	start: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
	onresult: ((e: SpeechRecognitionEvent) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
	interimResults: boolean;
	continuous: boolean;
}

let capturedInstance: MockInstance | null = null;

function makeMockInstance(): MockInstance {
	return {
		start: vi.fn(),
		stop: vi.fn(),
		onresult: null,
		onerror: null,
		onend: null,
		interimResults: false,
		continuous: false
	};
}

beforeEach(() => {
	capturedInstance = makeMockInstance();
	vi.stubGlobal(
		'SpeechRecognition',
		vi.fn(function () {
			return capturedInstance;
		})
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	capturedInstance = null;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel(noteContent = 'existing note content') {
	const note = createTestNote({ content: noteContent });
	const onsave = vi.fn();
	render(FolderPanel, {
		props: {
			folder: 'inbox',
			note,
			renaming: false,
			renameName: '',
			confirming: false,
			onsave
		}
	});
	return { onsave, note };
}

function getTextarea() {
	return screen.getByPlaceholderText('Start writing...') as HTMLTextAreaElement;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('voice dictation toolbar', () => {
	it('mic button is always visible when speech is supported', () => {
		renderPanel();
		expect(screen.getByRole('button', { name: 'Dictate' })).toBeInTheDocument();
	});

	it('calls recognition.start() on pointerdown', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));
		expect(capturedInstance!.start).toHaveBeenCalledOnce();
	});

	it('calls recognition.stop() on pointerup', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		const micBtn = screen.getByRole('button', { name: 'Dictate' });
		await fireEvent.pointerDown(micBtn);
		await fireEvent.pointerUp(micBtn);
		expect(capturedInstance!.stop).toHaveBeenCalledOnce();
	});

	it('calls recognition.stop() on pointercancel', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		const micBtn = screen.getByRole('button', { name: 'Dictate' });
		await fireEvent.pointerDown(micBtn);
		await fireEvent.pointerCancel(micBtn);
		expect(capturedInstance!.stop).toHaveBeenCalledOnce();
	});

	it('appends transcript to note content and calls onsave', async () => {
		const { onsave } = renderPanel('existing note content');
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));

		// Simulate final recognition result
		capturedInstance!.onresult?.({
			results: {
				0: { 0: { transcript: 'hello world' }, isFinal: true }
			}
		} as unknown as SpeechRecognitionEvent);

		expect(onsave).toHaveBeenCalledWith('existing note content hello world');
	});

	it('handles empty note content — no leading space', async () => {
		const { onsave } = renderPanel('');
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));

		// Simulate final recognition result
		capturedInstance!.onresult?.({
			results: { 0: { 0: { transcript: 'first words' }, isFinal: true } }
		} as unknown as SpeechRecognitionEvent);

		expect(onsave).toHaveBeenCalledWith('first words');
	});

	it('shows interim transcript in the textarea while speaking', async () => {
		renderPanel('existing content');
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));

		// Simulate a non-final (interim) result
		capturedInstance!.onresult?.({
			results: { 0: { 0: { transcript: 'hello...' }, isFinal: false } }
		} as unknown as SpeechRecognitionEvent);
		await tick();

		// The textarea value should reflect dictationBase + interim preview
		expect(getTextarea().value).toBe('existing content hello...');
	});

	it('stops listening after onerror fires', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));

		// Verify button shows pressed state before error
		expect(screen.getByRole('button', { name: 'Dictate' })).toHaveAttribute('aria-pressed', 'true');

		capturedInstance!.onerror?.();
		await tick();

		expect(screen.getByRole('button', { name: 'Dictate' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('stops listening after onend fires', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));

		expect(screen.getByRole('button', { name: 'Dictate' })).toHaveAttribute('aria-pressed', 'true');

		capturedInstance!.onend?.();
		await tick();

		expect(screen.getByRole('button', { name: 'Dictate' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('mic button not shown when SpeechRecognition is unsupported', async () => {
		vi.unstubAllGlobals(); // remove SpeechRecognition mock → supported = false
		renderPanel();
		await fireEvent.focus(getTextarea());
		expect(screen.queryByRole('button', { name: 'Dictate' })).not.toBeInTheDocument();
	});
});
