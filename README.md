# MyLife

Personal second-brain PWA for capturing notes, to-dos, bookmarks, and podcasts. Zero hosting cost — deployed on GitHub Pages with notes stored as markdown files in a private GitHub repo.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5 (static adapter)
- **Hosting**: GitHub Pages
- **Storage**: Private GitHub repo via REST API
- **Offline**: IndexedDB + Service Worker (PWA)
- **Testing**: Vitest + @testing-library/svelte + Playwright
- **Style**: Catppuccin Mocha dark theme

## Getting Started

```bash
npm install
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript checking |
| `npm run lint` | ESLint |
| `npm run format` | Prettier check |
| `npm run test` | Run integration tests |
| `npm run validate` | Run all checks |

## Features

- Plain text notes and to-do lists
- Folder-based organization (mirrors GitHub repo structure)
- Full-text search across all notes
- Pinned/favorited notes
- Auto-created daily notes
- YouTube URL auto-embed
- Voice dictation (Web Speech API)
- Auto-save with offline queue
- PWA — installable on Android, works offline

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via GitHub Actions.
