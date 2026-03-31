let keyboardOffset = $state(0);

if (typeof window !== 'undefined' && window.visualViewport) {
	window.visualViewport.addEventListener('resize', () => {
		keyboardOffset = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
	});
}

export function getKeyboardOffset() {
	return keyboardOffset;
}
