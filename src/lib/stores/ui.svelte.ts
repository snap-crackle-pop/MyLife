let sidebarOpen = $state(true);
let sidebarCollapsed = $state(false);
let selectedFolder = $state<string | null>(null);

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

export function getSelectedFolder() {
	return selectedFolder;
}

export function setSelectedFolder(folder: string | null) {
	selectedFolder = folder;
}
