import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	js.configs.recommended,
	prettier,
	...svelte.configs['flat/recommended'],
	...svelte.configs['flat/prettier'],
	{
		rules: {
			// Pure functions using Map/Date don't need Svelte reactive wrappers
			'svelte/prefer-svelte-reactivity': 'off',
			// goto() without resolve() is intentional for auth redirects in onMount
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		languageOptions: {
			globals: globals.browser
		}
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			'@typescript-eslint': ts
		},
		rules: {
			...ts.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-undef': 'off'
		}
	},
	{
		files: ['*.config.js', '*.config.ts', 'vite.config.ts'],
		languageOptions: {
			globals: globals.node
		}
	},
	{
		files: ['tests/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.browser,
				vi: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly'
			}
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/']
	}
];
