# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ReviewBuddy** - AI-powered code review GitHub Action with multi-provider support.

- **Stack**: JavaScript (Node.js ≥18.0.0)
- **Type**: GitHub Action
- **Pattern**: Adapter pattern for multiple AI providers
- **Features**: Auto PR title/description, smart labels, code analysis, adaptive personas, multi-language support

## Commands

```bash
npm install          # Install dependencies
npm test            # Run tests
npm run lint        # ESLint check
node src/index.js   # Local testing (requires env vars)
```

## Core Rules (NON-NEGOTIABLE)

1. **NEVER hardcode credentials**: Always use `process.env` and `core.getInput()`
2. **ALWAYS validate inputs**: Check required inputs, validate formats
3. **NEVER break GitHub Actions API**: Respect `@actions/core`, `@actions/github` contracts
4. **Respect API limits**: Implement rate limiting, retries, exponential backoff
5. **SOLID + DRY**: No duplication, modular adapters
6. **Update docs**: README.md, action.yml when features change

## Definition of "Done"

- ✅ Code follows standards
- ✅ Tests pass (if tests exist)
- ✅ Docs updated (README.md, action.yml)
- ✅ No breaking changes (unless approved)
- ✅ Secrets/tokens secured
- ✅ Error messages helpful

## Structure

```
src/
├── index.js           # Main entry point
├── adapters/          # AI provider adapters
│   ├── gemini.js      # Google Gemini
│   ├── openrouter.js  # OpenRouter
│   └── github.js      # GitHub Models
├── prompts/           # AI prompt templates
│   ├── review.js      # Code review prompts
│   ├── title.js       # PR title generation
│   └── label.js       # Label suggestion
├── github/            # GitHub API interactions
│   ├── pr.js          # Pull request operations
│   ├── comments.js    # Comment handling
│   └── labels.js      # Label management
└── utils/             # Utility functions
    ├── logger.js      # Logging
    ├── retry.js       # Retry logic
    └── validator.js   # Input validation

.github/workflows/     # CI/CD workflows
action.yml            # GitHub Action metadata
```

## Key Constraints

- **GitHub Actions runtime**: Node.js 18/20, runs in GitHub-hosted runners
- **API rate limits**: GitHub API, AI provider limits
- **No state persistence**: Stateless action, no file storage between runs
- **Security**: Never log secrets, sanitize user inputs, validate tokens
- **Backward compatibility**: Maintain `action.yml` inputs/outputs schema

## GitHub Action Patterns

### Input Validation
```javascript
// ✅ GOOD: Validate and provide defaults
const token = core.getInput('github-token', { required: true });
const provider = core.getInput('ai-provider') || 'gemini';
if (!['gemini', 'openrouter', 'github'].includes(provider)) {
  core.setFailed(`Invalid provider: ${provider}`);
  return;
}
```

### Error Handling
```javascript
// ✅ GOOD: Use core.setFailed for action failures
try {
  const result = await reviewPR(context, token);
  core.setOutput('review-result', result);
} catch (error) {
  core.error(`Review failed: ${error.message}`);
  core.setFailed(error.message);
}
```

### Secrets Management
```javascript
// ✅ GOOD: Mask secrets in logs
const apiKey = core.getInput('gemini-api-key', { required: true });
core.setSecret(apiKey); // Masks in logs

// ❌ BAD: Logging secrets
console.log(`Using API key: ${apiKey}`); // NEVER
```

### Adapter Pattern
```javascript
// ✅ GOOD: Pluggable AI providers
class GeminiAdapter {
  async generateReview(code, context) {
    // Gemini-specific implementation
  }
}

class OpenRouterAdapter {
  async generateReview(code, context) {
    // OpenRouter-specific implementation
  }
}

const adapters = {
  gemini: new GeminiAdapter(),
  openrouter: new OpenRouterAdapter(),
  github: new GitHubModelsAdapter()
};
```

## AI Provider Integration

### Rate Limiting
```javascript
// ✅ GOOD: Implement backoff
async function callAI(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.generate(prompt);
    } catch (error) {
      if (error.status === 429) {
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

### Persona Support
```javascript
// ✅ GOOD: Configurable personas
const personas = {
  roast: "You are a brutally honest code reviewer...",
  professional: "You are a senior software engineer...",
  funny: "You are a comedian reviewing code...",
  friendly: "You are a helpful mentor..."
};

const systemPrompt = personas[core.getInput('persona')] || personas.professional;
```

## Security Standards

### Input Sanitization
```javascript
// ✅ GOOD: Sanitize user inputs
function sanitizeInput(input) {
  return input.trim().replace(/[<>]/g, '');
}

// Validate PR number
const prNumber = parseInt(core.getInput('pr-number'), 10);
if (isNaN(prNumber) || prNumber < 1) {
  core.setFailed('Invalid PR number');
}
```

### Token Validation
```javascript
// ✅ GOOD: Validate GitHub token
const octokit = github.getOctokit(token);
try {
  await octokit.rest.users.getAuthenticated();
} catch (error) {
  core.setFailed('Invalid GitHub token');
}
```

## Testing (if implemented)

```javascript
// Mock GitHub Actions core
jest.mock('@actions/core');
jest.mock('@actions/github');

test('should generate PR review', async () => {
  core.getInput.mockReturnValue('gemini');
  const result = await generateReview(mockContext);
  expect(result).toHaveProperty('suggestions');
});
```

## Documentation Updates

### action.yml
When adding inputs/outputs:
```yaml
inputs:
  new-feature:
    description: 'New feature description'
    required: false
    default: 'value'
outputs:
  new-output:
    description: 'Output description'
```

### README.md
Update usage examples, feature list, configuration options

## Performance

- **Minimize API calls**: Batch requests, cache when possible
- **Async/await**: Use Promise.all for parallel operations
- **Stream responses**: For large AI responses
- **Timeout handling**: Set reasonable timeouts (30-60s)

## Review Checklist

- [ ] SOLID principles
- [ ] No hardcoded secrets
- [ ] Input validation
- [ ] Error handling with core.setFailed
- [ ] Secrets masked with core.setSecret
- [ ] Rate limiting implemented
- [ ] Backward compatible (action.yml)
- [ ] README updated
- [ ] Tests pass (if exist)

## Common Pitfalls

### ❌ BAD: Synchronous operations
```javascript
const reviews = [];
for (const file of files) {
  reviews.push(await reviewFile(file)); // Sequential
}
```

### ✅ GOOD: Parallel operations
```javascript
const reviews = await Promise.all(
  files.map(file => reviewFile(file))
);
```

### ❌ BAD: Exposing secrets
```javascript
console.log('Config:', { apiKey, token }); // Leaked
```

### ✅ GOOD: Safe logging
```javascript
core.setSecret(apiKey);
core.debug('Config loaded successfully');
```

## Summary
- GitHub Action: Use `@actions/core`, `@actions/github`
- Security: Validate inputs, mask secrets, sanitize data
- Adapters: Pluggable AI providers (Gemini, OpenRouter, GitHub)
- Error handling: core.setFailed for failures
- Performance: Async, rate limiting, retries
- Docs: Update action.yml and README.md
