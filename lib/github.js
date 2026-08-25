const GITHUB_API = 'https://api.github.com';
const REPO = 'enygmaticism/enygma';

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export async function readJsonFile(path, fallback) {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, {
    headers: headers()
  });
  if (response.status === 404) return { data: fallback, sha: null };
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  const body = await response.json();
  const decoded = Buffer.from(body.content, 'base64').toString('utf8');
  return { data: JSON.parse(decoded), sha: body.sha };
}

export async function writeJsonFile(path, data, sha, message) {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString('base64'),
      ...(sha ? { sha } : {})
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`GitHub write failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.json();
}

export async function updateJsonFile(path, fallback, mutator, message) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const current = await readJsonFile(path, fallback);
      const next = await mutator(structuredClone(current.data));
      return await writeJsonFile(path, next, current.sha, message);
    } catch (error) {
      lastError = error;
      if (error.status !== 409) throw error;
    }
  }
  throw lastError;
}
