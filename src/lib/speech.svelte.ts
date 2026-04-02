/// <reference types="@types/web" />

// Minimal SpeechRecognition interface for type-checking (full types from @types/web)
interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;
	onend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
	onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
	onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

declare global {
	interface Window {
		SpeechRecognition?: typeof SpeechRecognition;
		webkitSpeechRecognition?: typeof SpeechRecognition;
	}

	var SpeechRecognition: new () => SpeechRecognition;
	var webkitSpeechRecognition: new () => SpeechRecognition;
}

export function useSpeechRecognition(ontranscript: (text: string) => void) {
	const Impl: (new () => SpeechRecognition) | undefined =
		typeof window !== 'undefined'
			? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
			: undefined;

	const supported = !!Impl;
	let listening = $state(false);
	let interim = $state('');
	let recognition: SpeechRecognition | null = null;

	function start() {
		if (!Impl || listening) return;
		recognition = new Impl();
		recognition.interimResults = true;
		recognition.continuous = false;
		recognition.onresult = (e: SpeechRecognitionEvent) => {
			const result = e.results[0];
			if (result.isFinal) {
				interim = '';
				ontranscript(result[0].transcript);
			} else {
				interim = result[0].transcript;
			}
		};
		recognition.onerror = () => {
			interim = '';
			listening = false;
		};
		recognition.onend = () => {
			interim = '';
			listening = false;
		};
		listening = true;
		recognition.start();
	}

	function stop() {
		recognition?.stop();
		interim = '';
		listening = false;
	}

	return {
		start,
		stop,
		get listening() {
			return listening;
		},
		get interim() {
			return interim;
		},
		supported
	};
}
