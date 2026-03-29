let sidebarOpen = $state(true);
let sidebarCollapsed = $state(false);

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
