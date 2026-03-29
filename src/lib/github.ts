interface GitHubTreeEntry {
	path: string;
	type: 'blob' | 'tree';
	sha: string;
}

export interface GitHubFile {
	path: string;
	sha: string;
}

export class GitHubClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(token: string, repo: string) {
		this.baseUrl = `https://api.github.com/repos/${repo}`;
		this.headers = {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
			'Content-Type': 'application/json'
		};
	}

	private async request<T>(url: string, options?: RequestInit): Promise<T> {
		const response = await fetch(url, { ...options, headers: this.headers });
		if (!response.ok) {
			throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
		}
		return response.json() as Promise<T>;
	}

	async listFiles(): Promise<GitHubFile[]> {
		const data = await this.request<{ tree: GitHubTreeEntry[] }>(
			`${this.baseUrl}/git/trees/main?recursive=1`
		);
		return data.tree
			.filter((entry) => entry.type === 'blob')
			.map(({ path, sha }) => ({ path, sha }));
	}

	async getFileContent(path: string): Promise<{ content: string; sha: string }> {
		const data = await this.request<{ content: string; sha: string }>(
			`${this.baseUrl}/contents/${path}`
		);
		return {
			content: atob(data.content.replace(/\n/g, '')),
			sha: data.sha
		};
	}

	async createFile(path: string, content: string): Promise<string> {
		const data = await this.request<{ content: { sha: string } }>(
			`${this.baseUrl}/contents/${path}`,
			{
				method: 'PUT',
				body: JSON.stringify({
					message: `Create ${path}`,
					content: btoa(content)
				})
			}
		);
		return data.content.sha;
	}

	async updateFile(path: string, content: string, sha: string): Promise<string> {
		const data = await this.request<{ content: { sha: string } }>(
			`${this.baseUrl}/contents/${path}`,
			{
				method: 'PUT',
				body: JSON.stringify({
					message: `Update ${path}`,
					content: btoa(content),
					sha
				})
			}
		);
		return data.content.sha;
	}

	async deleteFile(path: string, sha: string): Promise<void> {
		await this.request(`${this.baseUrl}/contents/${path}`, {
			method: 'DELETE',
			body: JSON.stringify({
				message: `Delete ${path}`,
				sha
			})
		});
	}
}
