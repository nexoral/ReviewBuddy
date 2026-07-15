jest.mock('../src/utils', () => {
  const original = jest.requireActual('../src/utils');
  return {
    ...original,
    logInfo: jest.fn(),
    logSuccess: jest.fn(),
    logWarning: jest.fn(),
    logError: jest.fn()
  };
});

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { isReviewableFile, getLocalDiff, getFullFile, buildRepoMap, splitDiffByFile } = require('../src/utils/gitContext');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

describe('gitContext', () => {
  describe('isReviewableFile', () => {
    test('rejects lockfiles, generated dirs, and binaries', () => {
      expect(isReviewableFile('package-lock.json')).toBe(false);
      expect(isReviewableFile('dist/bundle.js')).toBe(false);
      expect(isReviewableFile('src/logo.min.js')).toBe(false);
      expect(isReviewableFile('assets/logo.png')).toBe(false);
    });

    test('accepts real source files', () => {
      expect(isReviewableFile('src/index.js')).toBe(true);
      expect(isReviewableFile('src/utils/helper.ts')).toBe(true);
    });
  });

  describe('against a real throwaway repo', () => {
    let tmpRoot, bareDir, workDir, baseSha, headSha;

    beforeAll(() => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewbuddy-gitctx-'));
      bareDir = path.join(tmpRoot, 'bare.git');
      workDir = path.join(tmpRoot, 'work');

      fs.mkdirSync(bareDir);
      git(bareDir, ['init', '--bare', '-q']);

      fs.mkdirSync(workDir);
      git(workDir, ['init', '-q']);
      git(workDir, ['config', 'user.email', 'test@example.com']);
      git(workDir, ['config', 'user.name', 'test']);
      git(workDir, ['remote', 'add', 'origin', bareDir]);

      fs.mkdirSync(path.join(workDir, 'lib'));
      fs.writeFileSync(path.join(workDir, 'lib', 'helper.js'), "function helper() {\n  return 1;\n}\nmodule.exports = { helper };\n");
      fs.writeFileSync(path.join(workDir, 'index.js'), "const { helper } = require('./lib/helper');\nconsole.log(helper());\n");
      git(workDir, ['add', '-A']);
      git(workDir, ['commit', '-q', '-m', 'base']);
      baseSha = git(workDir, ['rev-parse', 'HEAD']).trim();
      git(workDir, ['push', '-q', 'origin', 'HEAD:refs/heads/main']);

      fs.writeFileSync(path.join(workDir, 'index.js'), "const { helper } = require('./lib/helper');\nconsole.log(helper() + 1);\n");
      fs.writeFileSync(path.join(workDir, 'package-lock.json'), '{"lockfileVersion": 3}\n');
      git(workDir, ['add', '-A']);
      git(workDir, ['commit', '-q', '-m', 'head']);
      headSha = git(workDir, ['rev-parse', 'HEAD']).trim();
      git(workDir, ['push', '-q', 'origin', 'HEAD:refs/heads/main']);
    });

    afterAll(() => {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    test('getLocalDiff filters out the lockfile and returns a real diff for index.js', () => {
      const result = getLocalDiff({ repoRoot: workDir, baseSha, headSha, contextLines: 10 });
      expect(result).not.toBeNull();
      expect(result.files).toEqual(['index.js']);
      expect(result.skipped).toEqual(['package-lock.json']);
      expect(result.diff).toContain('index.js');
      expect(result.diff).toContain('helper() + 1');
    });

    test('getFullFile returns full content at a given sha', () => {
      const content = getFullFile(workDir, headSha, 'index.js');
      expect(content).toContain("helper() + 1");
    });

    test('getFullFile returns null for a nonexistent path', () => {
      expect(getFullFile(workDir, headSha, 'does/not/exist.js')).toBeNull();
    });

    test('buildRepoMap resolves the one-hop local import and extracts its signature', () => {
      const map = buildRepoMap(workDir, headSha, ['index.js']);
      expect(map['index.js']).toBeDefined();
      expect(map['index.js']['lib/helper.js']).toBeDefined();
      expect(map['index.js']['lib/helper.js'].some(sig => sig.includes('module.exports'))).toBe(true);
    });

    test('getLocalDiff returns null when the sha does not exist', () => {
      const result = getLocalDiff({ repoRoot: workDir, baseSha: '0'.repeat(40), headSha, contextLines: 10 });
      expect(result).toBeNull();
    });
  });

  describe('splitDiffByFile', () => {
    test('splits a multi-file unified diff into per-file chunks', () => {
      const diff = [
        'diff --git a/foo.js b/foo.js',
        'index 111..222 100644',
        '--- a/foo.js',
        '+++ b/foo.js',
        '@@ -1 +1 @@',
        '-old',
        '+new',
        'diff --git a/bar.js b/bar.js',
        'index 333..444 100644',
        '--- a/bar.js',
        '+++ b/bar.js',
        '@@ -1 +1 @@',
        '-x',
        '+y'
      ].join('\n');

      const chunks = splitDiffByFile(diff);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].file).toBe('foo.js');
      expect(chunks[1].file).toBe('bar.js');
      expect(chunks[0].chunk).toContain('-old');
      expect(chunks[1].chunk).toContain('-x');
    });

    test('returns an empty array for empty input', () => {
      expect(splitDiffByFile('')).toEqual([]);
      expect(splitDiffByFile(null)).toEqual([]);
    });
  });
});
