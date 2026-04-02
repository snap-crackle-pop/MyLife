# Voice Dictation — Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Add press-and-hold voice dictation to the note editor. A mic button appears in the top-right of the note section when the textarea is focused. Holding the button records speech; releasing appends the final transcript to the end of the note.

---

## Architecture

### `src/lib/speech.svelte.ts` — composable

Wraps the browser-native `window.SpeechRecognition` API. Exported as a single factory function:

```ts
useSpeechRecognition(ontranscript: (text: string) => void): {
  start(): void
  stop(): void
  listening: boolean   // reactive $state
  supported: boolean   // false on unsupported browsers (Firefox)
}
```

Configuration:
- `interimResults: false` — only final results
- `continuous: false` — single utterance per hold session
- On `onresult`: calls `ontranscript` with the recognised string
- On `onerror`: resets `listening` to false silently

### `src/lib/components/FolderPanel.svelte` — changes

- Add `$state(focused)` tracking textarea focus/blur
- Instantiate `useSpeechRecognition()` with a callback that appends text to note content and triggers the existing `onsave` debounce
- Render `.note-toolbar` div (absolutely positioned, top-right of `.panel`) when `focused === true`

---

## UI & Interaction

### Note toolbar

- Absolutely positioned in the top-right corner of `.panel`
- Fades in/out with `opacity` transition (`0.1s`, matching existing transitions) on textarea focus/blur
- Contains one button: mic icon (flat SVG line icon, 16×16, matches existing icon style)

### Mic button behaviour

| State | Appearance |
|---|---|
| Idle | `var(--text-muted)` colour |
| Listening | `var(--accent)` colour with a subtle CSS pulse animation |
| Unsupported | Hidden entirely (`supported === false`) |

- `onpointerdown` → `recognition.start()`
- `onpointerup` + `onpointercancel` → `recognition.stop()`

### On transcript received

Append to the note with a leading space:

```
existingContent + ' ' + transcript
```

Then trigger the existing 800ms debounced `onsave`.

---

## Error Handling

| Error | Behaviour |
|---|---|
| Mic permission denied (`not-allowed`) | Reset `listening` to false silently |
| Network error during recognition | Reset `listening` to false silently |
| Browser unsupported | Hide mic button, no error shown |

No retry logic. User can press-hold again to retry.

---

## Testing

### Unit — `useSpeechRecognition`

Mock `window.SpeechRecognition` in Vitest. Verify:
- `start()` / `stop()` delegate to the mock recognition instance
- `listening` toggles to `true` on start, `false` on stop/error
- `ontranscript` callback fires with the recognised text on `onresult`
- `onerror` resets `listening` without throwing

### Integration — `FolderPanel`

Use `@testing-library/svelte`. Mock `useSpeechRecognition`. Verify:
- Mic toolbar is not rendered when textarea is blurred
- Mic toolbar appears when textarea is focused
- `pointerdown` on mic button calls `start()`
- `pointerup` on mic button calls `stop()`
- After mock fires transcript, note content has text appended and `onsave` is called

### E2E

No Playwright test — browser mic permission cannot be reliably granted in automated tests.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/speech.svelte.ts` | New — composable |
| `src/lib/components/FolderPanel.svelte` | Add toolbar + wire composable |
| `tests/integration/voice-dictation.test.ts` | New — unit + integration tests |
