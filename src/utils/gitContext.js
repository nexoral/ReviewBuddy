// src/utils/gitContext.js
// Local-git-based diff/context helpers. Requires the calling workflow to have
// checked out the repo (see action.yml). All functions fail soft (return
// null) so callers can fall back to the GitHub API diff path.
const { execFileSync } = require('child_process');
const path = require('path');
const { logWarning } = require('./index');

const MAX_SIGNATURE_LINES_PER_FILE = 40;
const MAX_DEPS_PER_FILE = 15; // caps repo-map context so one import-heavy file can't blow the per-file budget

// Paths whose diffs add cost without adding review value.
const SKIP_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)(dist|build|vendor|out|coverage)\//,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Gemfile\.lock)$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.(png|jpe?g|gif|svg|ico|webp|pdf|zip|gz|tar|woff2?|ttf|eot|mp4|mp3|wasm)$/i
];

function isReviewableFile(filePath) {
  return !SKIP_PATTERNS.some(re => re.test(filePath));
}

function run(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

/**
 * Fetches base/head commits and returns a filtered, context-rich diff.
 * Returns null on any failure so callers can fall back to the API diff.
 */
function getLocalDiff({ repoRoot, baseSha, headSha, contextLines = 50 }) {
  try {
    run(repoRoot, ['fetch', '--depth=1', 'origin', baseSha]);
    run(repoRoot, ['fetch', '--depth=1', 'origin', headSha]);

    const nameOnly = run(repoRoot, ['diff', '--name-only', baseSha, headSha])
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    const files = nameOnly.filter(isReviewableFile);
    const skipped = nameOnly.filter(f => !isReviewableFile(f));

    if (files.length === 0) {
      return { diff: '', files: [], skipped };
    }

    const diff = run(repoRoot, ['diff', `-U${contextLines}`, baseSha, headSha, '--', ...files]);
    return { diff, files, skipped };
  } catch (error) {
    logWarning(`Local git diff unavailable, falling back to API diff: ${error.message}`);
    return null;
  }
}

/**
 * Returns the full content of a file at a given commit, or null if unreadable.
 */
function getFullFile(repoRoot, sha, filePath) {
  try {
    return run(repoRoot, ['show', `${sha}:${filePath}`]);
  } catch (error) {
    return null;
  }
}

const IMPORT_RE = /(?:require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|from\s+['"](\.{1,2}\/[^'"]+)['"])/g;
const SIGNATURE_RE = /^\s*(?:module\.exports\s*=.*|exports\.\w+\s*=.*|(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)|(?:export\s+)?class\s+\w+.*|(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:export\s+)?const\s+\w+\s*=\s*require\(.*\))\s*\{?\s*$/;

function resolveImport(fromFile, importPath, trackedFiles) {
  const base = path.normalize(path.join(path.dirname(fromFile), importPath)).replace(/\\/g, '/');
  const candidates = [base, `${base}.js`, `${base}.ts`, `${base}.jsx`, `${base}.tsx`, `${base}/index.js`, `${base}/index.ts`];
  return candidates.find(c => trackedFiles.has(c)) || null;
}

function extractSignatures(content) {
  return content
    .split('\n')
    .filter(line => SIGNATURE_RE.test(line))
    .slice(0, MAX_SIGNATURE_LINES_PER_FILE)
    .map(line => line.trim());
}

/**
 * One-hop repo map: for each changed file, the exported signatures of the
 * local files it directly imports (not full bodies, not reverse deps).
 * ponytail: reverse (who-imports-me) lookup skipped — that's O(repo) instead
 * of O(changed files); add it if a real case needs it.
 */
function buildRepoMap(repoRoot, headSha, changedFiles) {
  try {
    const trackedFiles = new Set(
      run(repoRoot, ['ls-tree', '-r', '--name-only', headSha]).split('\n').filter(Boolean)
    );

    const map = {};
    for (const file of changedFiles) {
      const content = getFullFile(repoRoot, headSha, file);
      if (!content) continue;

      const deps = new Set();
      let match;
      IMPORT_RE.lastIndex = 0;
      while ((match = IMPORT_RE.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        const resolved = resolveImport(file, importPath, trackedFiles);
        if (resolved && resolved !== file) deps.add(resolved);
      }

      const depSignatures = {};
      for (const dep of Array.from(deps).slice(0, MAX_DEPS_PER_FILE)) {
        const depContent = getFullFile(repoRoot, headSha, dep);
        if (depContent) depSignatures[dep] = extractSignatures(depContent);
      }

      if (Object.keys(depSignatures).length > 0) map[file] = depSignatures;
    }
    return map;
  } catch (error) {
    logWarning(`Repo map unavailable: ${error.message}`);
    return {};
  }
}

/**
 * Splits a unified diff (local git or GitHub API — both use the same
 * `diff --git a/x b/y` file header) into one chunk per file.
 */
function splitDiffByFile(diffText) {
  if (!diffText) return [];
  return diffText
    .split(/(?=^diff --git )/m)
    .filter(Boolean)
    .map(chunk => {
      const match = chunk.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
      return { file: match ? match[2] : 'unknown', chunk };
    });
}

module.exports = { isReviewableFile, getLocalDiff, getFullFile, buildRepoMap, splitDiffByFile };
