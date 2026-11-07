const API = 'https://api.github.com';

const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.kt',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.cs',
  '.swift',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.sql',
];

const SKIP_PATTERN =
  /(^|\/)(node_modules|dist|build|vendor|\.git|__pycache__)\/|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css)$|\.d\.ts$/;

const MAX_FILES = 40;
const MAX_FILE_CHARS = 6000;
const MAX_TOTAL_CHARS = 120000;

export interface RepoSummary {
  fullName: string;
  name: string;
  language: string | null;
  updatedAt: string;
}

export interface RepoContext {
  repoFullName: string;
  files: { path: string; content: string }[];
  text: string;
}

function headers(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'RepoInterview',
  };
}

export async function listPublicRepos(token: string): Promise<RepoSummary[]> {
  const response = await fetch(
    `${API}/user/repos?per_page=100&sort=updated&visibility=public`,
    { headers: headers(token) },
  );
  if (!response.ok) {
    throw new Error(`GitHub repo list failed (${response.status})`);
  }

  const data = (await response.json()) as Array<{
    full_name: string;
    name: string;
    language: string | null;
    updated_at: string;
    private: boolean;
  }>;

  return data
    .filter((repo) => !repo.private)
    .map((repo) => ({
      fullName: repo.full_name,
      name: repo.name,
      language: repo.language,
      updatedAt: repo.updated_at,
    }));
}

export async function fetchRepoContext(
  token: string,
  repoFullName: string,
  focusArea: string,
): Promise<RepoContext> {
  const repoResponse = await fetch(`${API}/repos/${repoFullName}`, {
    headers: headers(token),
  });
  if (!repoResponse.ok) {
    throw new Error(
      repoResponse.status === 404
        ? 'Repository not found or not public'
        : `GitHub repository request failed (${repoResponse.status})`,
    );
  }

  const repo = (await repoResponse.json()) as { private: boolean; default_branch: string };
  if (repo.private) {
    throw new Error('Only public repositories are supported');
  }

  const treeResponse = await fetch(
    `${API}/repos/${repoFullName}/git/trees/${repo.default_branch}?recursive=1`,
    { headers: headers(token) },
  );
  if (!treeResponse.ok) {
    throw new Error(`GitHub file tree request failed (${treeResponse.status})`);
  }

  const tree = (await treeResponse.json()) as {
    tree: Array<{ path: string; type: string; size?: number }>;
  };

  const focusWords = focusArea
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

  const candidates = tree.tree
    .filter((entry) => entry.type === 'blob')
    .filter((entry) => {
      const size = entry.size ?? 0;
      return size > 0 && size < 100000;
    })
    .filter(
      (entry) =>
        CODE_EXTENSIONS.some((extension) => entry.path.endsWith(extension)) &&
        !SKIP_PATTERN.test(entry.path),
    )
    .map((entry) => {
      const lower = entry.path.toLowerCase();
      const score = focusWords.some((word) => lower.includes(word)) ? 1 : 0;
      return { path: entry.path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, MAX_FILES);

  const files: { path: string; content: string }[] = [];
  let totalChars = 0;

  for (const candidate of candidates) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    const contentResponse = await fetch(
      `${API}/repos/${repoFullName}/contents/${candidate.path}?ref=${repo.default_branch}`,
      { headers: { ...headers(token), Accept: 'application/vnd.github.raw' } },
    );
    if (!contentResponse.ok) continue;

    let content = await contentResponse.text();
    if (content.length > MAX_FILE_CHARS) {
      content = `${content.slice(0, MAX_FILE_CHARS)}\n// [truncated]`;
    }

    files.push({ path: candidate.path, content });
    totalChars += content.length;
  }

  if (files.length === 0) {
    throw new Error('No readable code files were found in this repository');
  }

  const text = files
    .map((file) => `<file path="${file.path}">\n${file.content}\n</file>`)
    .join('\n\n');

  return { repoFullName, files, text };
}
