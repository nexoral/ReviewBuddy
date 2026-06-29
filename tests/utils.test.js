const { determineLabels, determineRecommendation, validateEnv } = require('../src/utils');

describe('determineLabels', () => {
  test('should return enhancement for feature titles', () => {
    expect(determineLabels('feat: add a nice login button', 80)).toContain('enhancement');
    expect(determineLabels('feature(auth): token refresh', 80)).toContain('enhancement');
  });

  test('should return bug for fix titles', () => {
    expect(determineLabels('fix: crash on undefined', 80)).toContain('bug');
    expect(determineLabels('bugfix: validation logic', 80)).toContain('bug');
  });

  test('should return good first review for high score', () => {
    expect(determineLabels('docs: update readmes', 95)).toContain('good first review');
  });

  test('should return needs work for low score', () => {
    expect(determineLabels('chore: clean logs', 45)).toContain('needs work');
  });

  test('should return security for security issues in text', () => {
    expect(determineLabels('refactor: update parser', 80, 'Critical vulnerability found')).toContain('security');
    expect(determineLabels('refactor: update parser', 80, 'High risk identified')).toContain('security');
  });

  test('should return performance for slow code issues in text', () => {
    expect(determineLabels('refactor: update parser', 80, null, 'The code is slow and needs to optimize')).toContain('performance');
  });
});

describe('determineRecommendation', () => {
  // Test Heuristics Fallback
  test('heuristics: should reject for score < 40', () => {
    const rec = determineRecommendation(35, 3, '', '', 'professional', 'english', null);
    expect(rec.status).toBe('REJECT');
  });

  test('heuristics: should request changes for score < 60', () => {
    const rec = determineRecommendation(55, 5, '', '', 'professional', 'english', null);
    expect(rec.status).toBe('REQUEST CHANGES');
  });

  test('heuristics: should approve for score >= 60', () => {
    const rec = determineRecommendation(75, 8, '', '', 'professional', 'english', null);
    expect(rec.status).toBe('APPROVE');
  });

  test('heuristics: should reject for critical security', () => {
    const rec = determineRecommendation(80, 8, 'Severity: Critical', '', 'professional', 'english', null);
    expect(rec.status).toBe('REJECT');
  });

  test('heuristics: should request changes for high security', () => {
    const rec = determineRecommendation(80, 8, 'Severity: High', '', 'professional', 'english', null);
    expect(rec.status).toBe('REQUEST CHANGES');
  });

  // Test Verdict Status Normalization
  test('normalization: should normalize APPROVED to APPROVE', () => {
    const rec = determineRecommendation(80, 8, '', '', 'professional', 'english', { status: 'APPROVED' });
    expect(rec.status).toBe('APPROVE');
  });

  test('normalization: should normalize REVIEW_NEEDED to REQUEST CHANGES', () => {
    const rec = determineRecommendation(80, 8, '', '', 'professional', 'english', { status: 'REVIEW_NEEDED' });
    expect(rec.status).toBe('REQUEST CHANGES');
  });

  test('normalization: should normalize REJECTED to REJECT', () => {
    const rec = determineRecommendation(80, 8, '', '', 'professional', 'english', { status: 'REJECTED' });
    expect(rec.status).toBe('REJECT');
  });

  // Test Safety Validation and Overrides
  test('overrides: should override APPROVE to REJECT if score is too low', () => {
    const rec = determineRecommendation(30, 3, '', '', 'professional', 'english', { status: 'APPROVE' });
    expect(rec.status).toBe('REJECT');
  });

  test('overrides: should override APPROVE to REQUEST CHANGES if score is medium-low', () => {
    const rec = determineRecommendation(50, 5, '', '', 'professional', 'english', { status: 'APPROVE' });
    expect(rec.status).toBe('REQUEST CHANGES');
  });

  test('overrides: should override APPROVE to REJECT if critical security vulnerability is flagged', () => {
    const rec = determineRecommendation(90, 9, '', '', 'professional', 'english', { status: 'APPROVE', has_critical_security: true });
    expect(rec.status).toBe('REJECT');
  });

  test('overrides: should override APPROVE to REQUEST CHANGES if high security is flagged', () => {
    const rec = determineRecommendation(90, 9, '', '', 'professional', 'english', { status: 'APPROVE', has_high_security: true });
    expect(rec.status).toBe('REQUEST CHANGES');
  });

  test('overrides: should override REQUEST CHANGES to REJECT if critical security exists', () => {
    const rec = determineRecommendation(50, 5, '', '', 'professional', 'english', { status: 'REQUEST CHANGES', has_critical_security: true });
    expect(rec.status).toBe('REJECT');
  });
});

describe('validateEnv', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should throw error when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.INPUT_GITHUB_TOKEN;
    process.env.GEMINI_API_KEY = 'key';

    expect(() => validateEnv('gemini')).toThrow(/Missing required environment variables/);
  });

  test('should throw error when GEMINI_API_KEY is missing for gemini', () => {
    process.env.GITHUB_TOKEN = 'token';
    delete process.env.GEMINI_API_KEY;
    delete process.env.INPUT_GEMINI_API_KEY;

    expect(() => validateEnv('gemini')).toThrow(/Missing required environment variables/);
  });

  test('should pass validation when required env vars are present', () => {
    process.env.GITHUB_TOKEN = 'token';
    process.env.GEMINI_API_KEY = 'key';

    expect(() => validateEnv('gemini')).not.toThrow();
  });
});
