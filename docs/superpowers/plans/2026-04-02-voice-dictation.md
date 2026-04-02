# Voice Dictation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add press-and-hold voice dictation to the note editor — a mic button appears in the top-right of the note area when the textarea is focused; holding the button records speech via the Web Speech API and appends the final transcript to the note on release.

**Architecture:** A `useSpeechRecognition` Svelte 5 composable in `speech.svelte.ts` wraps the browser-native `SpeechRecognition` API and exposes `start()`, `stop()`, reactive `listening`, and `supported`. `FolderPanel.svelte` tracks textarea focus state, conditionally renders a `.note-toolbar` in the top-right corner of the editor wrapper, and wires up the mic button to the composable. On transcript, the callback appends text to the note content and calls `onsave` immediately.

**Tech Stack:** Svelte 5 runes (`$state`), Web Speech API (`window.SpeechRecognition` / `window.webkitSpeechRecognition`), `@testing-library/svelte` + Vitest, jsdom

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/speech.svelte.ts` | Create | Composable wrapping SpeechRecognition |
| `src/lib/components/FolderPanel.svelte` | Modify | Toolbar UI, focus tracking, composable wiring |
| `tests/integration/voice-dictation.test.ts` | Create | Integration tests for the full feature |

---

## Task 1: Create the speech composable

**Files:**
- Create: `src/lib/speech.svelte.ts`

- [ ] **Step 1: Create the file**

```ts
declare global {
	interface Window {
		SpeechRecognition?: typeof SpeechRecognition;
		webkitSpeechRecognition?: typeof SpeechRecognition;
	}
}

export function useSpeechRecognition(ontranscript: (text: string) => void) {
	const Impl: (new () => SpeechRecognition) | undefined =
		typeof window !== 'undefined'
			? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
			: undefined;

	const supported = !!Impl;
	let listening = $state(false);
	let recognition: SpeechRecognition | null = null;

	function start() {
		if (!Impl) return;
		recognition = new Impl();
		recognition.interimResults = false;
		recognition.continuous = false;
		recognition.onresult = (e: SpeechRecognitionEvent) => {
			ontranscript(e.results[0][0].transcript);
		};
		recognition.onerror = () => {
			listening = false;
		};
		recognition.onend = () => {
			listening = false;
		};
		listening = true;
		recognition.start();
	}

	function stop() {
		recognition?.stop();
		listening = false;
	}

	return {
		start,
		stop,
		get listening() {
			return listening;
		},
		supported
	};
}
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: 0 errors.

---

## Task 2: Write failing integration tests

**Files:**
- Create: `tests/integration/voice-dictation.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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
	vi.stubGlobal('SpeechRecognition', vi.fn(() => capturedInstance));
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
	it('mic button is not in DOM when textarea is not focused', () => {
		renderPanel();
		expect(screen.queryByRole('button', { name: 'Dictate' })).not.toBeInTheDocument();
	});

	it('mic button appears when textarea is focused', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		expect(screen.getByRole('button', { name: 'Dictate' })).toBeInTheDocument();
	});

	it('mic button disappears when textarea loses focus', async () => {
		renderPanel();
		await fireEvent.focus(getTextarea());
		await fireEvent.blur(getTextarea());
		expect(screen.queryByRole('button', { name: 'Dictate' })).not.toBeInTheDocument();
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

		// Simulate recognition result
		capturedInstance!.onresult?.({
			results: {
				0: { 0: { transcript: 'hello world' } }
			}
		} as unknown as SpeechRecognitionEvent);

		expect(onsave).toHaveBeenCalledWith('existing note content hello world');
	});

	it('handles empty note content — no leading space', async () => {
		const { onsave } = renderPanel('');
		await fireEvent.focus(getTextarea());
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictate' }));

		capturedInstance!.onresult?.({
			results: { 0: { 0: { transcript: 'first words' } } }
		} as unknown as SpeechRecognitionEvent);

		expect(onsave).toHaveBeenCalledWith('first words');
	});

	it('mic button not shown when SpeechRecognition is unsupported', async () => {
		vi.unstubAllGlobals(); // remove SpeechRecognition mock → supported = false
		renderPanel();
		await fireEvent.focus(getTextarea());
		expect(screen.queryByRole('button', { name: 'Dictate' })).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run the tests to confirm they all fail**

```bash
npm run test -- voice-dictation
```

Expected: All tests in `voice-dictation.test.ts` FAIL (FolderPanel has no mic toolbar yet).

---

## Task 3: Wire composable into FolderPanel

**Files:**
- Modify: `src/lib/components/FolderPanel.svelte`

The changes are:
1. Import `useSpeechRecognition`
2. Add `focused = $state(false)` to track textarea focus
3. Instantiate the composable with an `ontranscript` callback
4. Wrap the `<textarea>` in an `.editor-wrapper` div
5. Render `.note-toolbar` inside the wrapper when `focused && recognition.supported`
6. Add CSS for `.editor-wrapper`, `.note-toolbar`, `.mic-btn`

- [ ] **Step 1: Add import and composable instantiation to the `<script>` block**

In `FolderPanel.svelte`, after the existing `let saveTimer` declaration, add:

```ts
import { useSpeechRecognition } from '$lib/speech.svelte';
```

(Add this with the other imports at the top of the `<script>` block.)

Then after the `handleInput` function, add:

```ts
let focused = $state(false);

const recognition = useSpeechRecognition((text: string) => {
	const current = note?.content ?? '';
	const newContent = current ? `${current} ${text}` : text;
	onsave?.(newContent);
});
```

- [ ] **Step 2: Wrap the textarea in an editor wrapper and add the toolbar**

Replace:

```svelte
<textarea
	class="note-editor"
	value={note?.content ?? ''}
	oninput={handleInput}
	placeholder="Start writing..."
></textarea>
```

With:

```svelte
<div class="editor-wrapper">
	{#if focused && recognition.supported}
		<div class="note-toolbar">
			<button
				class="mic-btn"
				class:listening={recognition.listening}
				aria-label="Dictate"
				title="Hold to dictate"
				onpointerdown={(e) => {
					e.preventDefault();
					recognition.start();
				}}
				onpointerup={() => recognition.stop()}
				onpointercancel={() => recognition.stop()}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="9" y="2" width="6" height="12" rx="3" />
					<path d="M5 10a7 7 0 0 0 14 0" />
					<line x1="12" y1="17" x2="12" y2="22" />
					<line x1="9" y1="22" x2="15" y2="22" />
				</svg>
			</button>
		</div>
	{/if}
	<textarea
		class="note-editor"
		value={note?.content ?? ''}
		oninput={handleInput}
		placeholder="Start writing..."
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	></textarea>
</div>
```

- [ ] **Step 3: Add CSS**

In the `<style>` block, replace:

```css
.note-editor {
	flex: 1;
	width: 100%;
	padding: 16px 24px;
	background: var(--bg-surface);
	border: none;
	resize: none;
	font-family: inherit;
	font-size: 14px;
	line-height: 1.6;
	color: var(--text-primary);
	outline: none;
	box-sizing: border-box;
}

.note-editor::placeholder {
	color: var(--text-muted);
}
```

With:

```css
.editor-wrapper {
	flex: 1;
	position: relative;
	overflow: hidden;
	display: flex;
}

.note-toolbar {
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	gap: 4px;
	z-index: 1;
}

.mic-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	padding: 0;
	background: transparent;
	border: none;
	border-radius: var(--radius);
	color: var(--text-muted);
	cursor: pointer;
	transition:
		color 0.1s,
		background 0.1s;
}

.mic-btn:hover {
	background: var(--bg-base);
	color: var(--text-primary);
}

.mic-btn.listening {
	color: var(--accent);
	animation: mic-pulse 1s ease-in-out infinite;
}

@keyframes mic-pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}

.note-editor {
	flex: 1;
	width: 100%;
	padding: 16px 24px;
	background: var(--bg-surface);
	border: none;
	resize: none;
	font-family: inherit;
	font-size: 14px;
	line-height: 1.6;
	color: var(--text-primary);
	outline: none;
	box-sizing: border-box;
}

.note-editor::placeholder {
	color: var(--text-muted);
}
```

- [ ] **Step 4: Run the integration tests to confirm they pass**

```bash
npm run test -- voice-dictation
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npm run validate
```

Expected: 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/speech.svelte.ts src/lib/components/FolderPanel.svelte tests/integration/voice-dictation.test.ts
git commit -m "feat: add press-and-hold voice dictation to note editor"
```
