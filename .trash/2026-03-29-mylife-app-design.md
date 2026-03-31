# MyLife — Personal Second Brain App

## Overview

A personal note-taking and knowledge management PWA inspired by Obsidian's aesthetics. Built for a single user (Yogesh) with zero hosting cost. Notes stored as files in a private GitHub repo, app deployed as a static site on GitHub Pages.

## Problem

Need a single personal app to capture notes, to-dos, bookmarks, podcasts, and quick thoughts — accessible from both desktop browser and Android phone — without paying for hosting or cloud services.

## Tech Stack

- **Framework**: SvelteKit (static adapter for SSG)
- **Hosting**: GitHub Pages (free)
- **Data storage**: Private GitHub repo (markdown/text files via GitHub API)
- **Auth**: GitHub Personal Access Token (stored in browser localStorage)
- **PWA**: Service worker for offline support + installable on Android
- **Speech**: Web Speech API (browser-native, free)

## Architecture

```
┌─────────────────────────────────┐
│  SvelteKit Static PWA           │
│  (GitHub Pages)                 │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Sidebar   │  │ Editor     │  │
│  │ - Folders │  │ - Text     │  │
│  │ - Pinned  │  │ - Todos    │  │
│  │ - Search  │  │ - YouTube  │  │
│  │ - Trash   │  │ - Dictate  │  │
│  └───────────┘  └────────────┘  │
│           │                     │
│     GitHub API (REST)           │
│           │                     │
└───────────┼─────────────────────┘
            ▼
┌─────────────────────────────────┐
│  Private GitHub Repo            │
│  (notes as files)               │
│                                 │
│  /inbox/                        │
│  /work/                         │
│  /personal/                     │
│  /podcasts/                     │
│  /daily/2026-03-29.md           │
│  /.trash/                       │
└─────────────────────────────────┘
```

**Data flow**: App ↔ GitHub REST API ↔ Private repo. All reads/writes go through the GitHub API using the personal access token. Files are cached locally (IndexedDB) for offline access and synced back when online.

## Note Types

### Plain Text Notes
- Simple text content, no markdown formatting
- Easy to paste content into
- Auto-save as you type

### To-Do Lists
- Checkbox syntax (`- [ ]` / `- [x]`)
- Tap to toggle completion
- Stored as text files with checkbox markup

## Folder Structure

Folders mirror the GitHub repo directory structure:

- **Inbox** — Quick capture destination, sort later
- **User-created folders** — Work, Personal, etc.
- **Podcasts** — Dedicated media folder with YouTube embeds
- **Daily Notes** — Auto-created daily note (named by date)
- **Trash** — Soft-deleted notes, recoverable for 30 days

## Features

### Core
1. **Create/edit/delete notes** — Plain text or to-do list
2. **Folder navigation** — Hierarchical folder tree in sidebar
3. **Full-text search** — Client-side search across all note titles and content (indexed in memory)
4. **Pinned/favorites** — Star notes for quick access, shown in sidebar pinned section
5. **Daily note** — Auto-creates a note for today's date, accessible from sidebar
6. **Quick capture (Inbox)** — One-tap new note goes straight to Inbox folder
7. **Trash / soft delete** — Deleted notes move to .trash folder, auto-purged after 30 days

### YouTube Embed
- Paste a YouTube URL into any note → auto-detected and rendered as embedded player
- Dedicated Podcasts folder for organizing media collection
- Player states: paused (muted outline) and playing (brighter, audio bars animation, scrub controls)

### Voice Dictation
- Push-to-talk: hold mic button → speak → release → text appears in note
- Uses Web Speech API (browser-native, Chrome/Android)
- Mic button in editor toolbar (desktop) and bottom bar (mobile)
- States: inactive (muted outline circle), recording (bright outline, pulse animation)

### Auto-save
- Notes save automatically as you type
- Small "saved" indicator fades in/out — no save button

## UI Design

### Visual Style
- **Theme**: Dark, Obsidian-inspired (Catppuccin Mocha palette)
  - Background: `#1e1e2e`
  - Sidebar: `#181825`
  - Borders: `#313244`
  - Text primary: `#cdd6f4`
  - Text secondary: `#a6adc8`
  - Text muted: `#585b70`
- **Icons**: Flat, monochrome SVG line icons. No color, no emoji.
  - Inactive state: muted outline (`#585b70`)
  - Active state: brighter/filled white (`#cdd6f4`)
- **Typography**: System font stack (`-apple-system, sans-serif`)

### Desktop Layout
- **Sidebar** (left, ~260px): App title, quick action buttons (+ Note, + Todo), search bar, pinned section, folder tree, trash
- **Collapsible sidebar**: Toggle to collapse to icon-only rail; click icon to expand temporarily
- **Editor** (right): Note title, breadcrumb path, last-edited timestamp, content area, toolbar with mic/star/delete

### Mobile Layout (PWA)
- **Folder view**: Full-screen list with header, quick actions, search, pinned, folders
- **Note view**: Full-screen editor with back button, note title, content, bottom mic button
- **Navigation**: Tap folder → see notes list → tap note → editor. Back button to return.

### Interactions
- **Swipe gestures (mobile)**: Swipe left to delete, swipe right to pin/favorite
- **Long-press context menu (mobile)**: Pin, Move to folder, Delete
- **Inline note creation**: Start typing at the top of a folder view to create a new note. Hit enter and it becomes a note.
- **Keyboard shortcuts (desktop)**:
  - `Ctrl+N` — New note
  - `Ctrl+Shift+N` — New todo
  - `Ctrl+K` — Search
- **Note preview in folder list**: First line of note content shown as subtitle

## GitHub Repo Structure (Notes Data)

```
mylife-notes/           (private repo)
├── inbox/
│   └── quick-thought.md
├── work/
│   ├── project-notes.md
│   └── sprint-tasks.md
├── personal/
│   ├── shopping-list.md
│   └── book-list.md
├── podcasts/
│   └── tech-podcasts.md
├── daily/
│   ├── 2026-03-28.md
│   └── 2026-03-29.md
└── .trash/
    └── old-note.md
```

## Offline Strategy

1. On first load: fetch all notes from GitHub API, store in IndexedDB
2. Subsequent loads: serve from IndexedDB (instant), sync with GitHub in background
3. Edits while offline: save to IndexedDB, queue sync operations
4. When back online: push queued changes to GitHub
5. Conflict resolution: last-write-wins (single user, so conflicts are rare)

## Future Enhancements (Not in V1)
- Image support (storage TBD — GitHub repo, Imgur, or compressed)
- Tags for cross-cutting organization
- Note templates
- Export/backup functionality

## Verification Plan

1. **Local dev**: Run `npm run dev`, verify all features work in Chrome
2. **PWA install**: Test install-to-homescreen on Android Chrome
3. **GitHub sync**: Create test notes, verify they appear as files in the GitHub repo
4. **Offline**: Disable network, create/edit notes, re-enable and verify sync
5. **Voice dictation**: Test push-to-talk on Chrome desktop and Android
6. **YouTube embed**: Paste various YouTube URL formats, verify player renders
7. **Search**: Create 10+ notes, verify search finds content across folders
8. **Mobile gestures**: Test swipe-to-delete and swipe-to-pin on Android
