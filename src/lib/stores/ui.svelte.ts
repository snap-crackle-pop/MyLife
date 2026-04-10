let sidebarOpen = $state(false);
let sidebarCollapsed = $state(false);
let theme = $state<'dark' | 'light'>((localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark');
let searchHighlight = $state<{ query: string; folder: string } | null>(null);

export function getSidebarOpen() {
	return sidebarOpen;
}

export function setSidebarOpen(open: boolean) {
	sidebarOpen = open;
}

export function getSidebarCollapsed() {
	return sidebarCollapsed;
}

export function toggleSidebarCollapsed() {
	sidebarCollapsed = !sidebarCollapsed;
}

export function getTheme() {
	return theme;
}

export function toggleTheme() {
	theme = theme === 'dark' ? 'light' : 'dark';
	localStorage.setItem('theme', theme);
}

export function getSearchHighlight() {
	return searchHighlight;
}

export function setSearchHighlight(query: string, folder: string) {
	searchHighlight = { query, folder };
}

export function clearSearchHighlight() {
	searchHighlight = null;
}
