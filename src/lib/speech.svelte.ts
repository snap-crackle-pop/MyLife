// SpeechRecognition interface definition
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
