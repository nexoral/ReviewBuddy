const { estimateTokens, getDiffCharBudget, fitFindingsToBudget, DEFAULT_CONTEXT_TOKENS } = require('../src/utils/contextBudget');

describe('contextBudget', () => {
  describe('estimateTokens', () => {
    test('estimates roughly 4 chars per token', () => {
      expect(estimateTokens('a'.repeat(4000))).toBe(1000);
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null)).toBe(0);
    });
  });

  describe('getDiffCharBudget', () => {
    test('scales with a user-supplied context window, for any model', () => {
      const smallBudget = getDiffCharBudget(32000);
      const largeBudget = getDiffCharBudget(1000000);
      expect(largeBudget).toBeGreaterThan(smallBudget);
    });

    test('accepts the context size as a string (env vars are always strings)', () => {
      expect(getDiffCharBudget('128000')).toBe(getDiffCharBudget(128000));
    });

    test('falls back to the conservative default when unset, invalid, or non-positive', () => {
      const defaultBudget = getDiffCharBudget(DEFAULT_CONTEXT_TOKENS);
      expect(getDiffCharBudget(undefined)).toBe(defaultBudget);
      expect(getDiffCharBudget('')).toBe(defaultBudget);
      expect(getDiffCharBudget('not-a-number')).toBe(defaultBudget);
      expect(getDiffCharBudget(0)).toBe(defaultBudget);
      expect(getDiffCharBudget(-5)).toBe(defaultBudget);
    });
  });

  describe('fitFindingsToBudget', () => {
    test('keeps everything when it already fits', () => {
      const results = [
        { file: 'a.js', issues: [{ category: 'quality', severity: 'low' }] },
        { file: 'b.js', issues: [{ category: 'security', severity: 'critical' }] }
      ];
      const { kept, dropped } = fitFindingsToBudget(results, 10000);
      expect(kept).toEqual(results);
      expect(dropped).toEqual([]);
    });

    test('drops lower-severity results first when the input overflows the budget', () => {
      const results = [
        { file: 'low.js', issues: [{ category: 'quality', severity: 'low', comment: 'x'.repeat(500) }] },
        { file: 'critical.js', issues: [{ category: 'security', severity: 'critical', comment: 'y'.repeat(500) }] },
        { file: 'medium.js', issues: [{ category: 'quality', severity: 'medium', comment: 'z'.repeat(500) }] }
      ];
      // Budget only large enough for roughly one entry.
      const { kept, dropped } = fitFindingsToBudget(results, 600);

      expect(kept.length).toBeGreaterThan(0);
      expect(kept[0].file).toBe('critical.js');
      expect(dropped).toContain('low.js');
    });

    test('never exceeds the given budget', () => {
      const results = Array.from({ length: 50 }, (_, i) => ({
        file: `file${i}.js`,
        issues: [{ category: 'quality', severity: 'medium', comment: 'x'.repeat(200) }]
      }));
      const budget = 3000;
      const { kept } = fitFindingsToBudget(results, budget);
      expect(JSON.stringify(kept).length).toBeLessThanOrEqual(budget);
    });
  });
});
