# ReviewBuddy - OpenAI Codex CLI Instructions

## Project Overview

**ReviewBuddy** is a GitHub Action that provides AI-powered code reviews for pull requests.

- **Language**: JavaScript (Node.js ≥18.0.0)
- **Type**: GitHub Action
- **Runtime**: GitHub Actions environment
- **Pattern**: Adapter pattern for multiple AI providers

## Core Commands

```bash
npm install              # Install dependencies
npm test                # Run tests
npm run lint            # ESLint check
node src/index.js       # Local testing (requires env vars)
```

## Critical Rules

### 1. Security (NON-NEGOTIABLE)
```javascript
// ✅ ALWAYS: Mask secrets
const apiKey = core.getInput('gemini-api-key', { required: true });
core.setSecret(apiKey);

// ❌ NEVER: Log secrets
console.log(`API Key: ${apiKey}`); // FORBIDDEN
```

### 2. GitHub Actions API
```javascript
// ✅ ALWAYS: Use @actions/core for inputs/outputs
const token = core.getInput('github-token', { required: true });
core.setOutput('review-result', result);

// ✅ ALWAYS: Use core.setFailed for errors
try {
  await reviewPR();
} catch (error) {
  core.setFailed(error.message);
}
```

### 3. Adapter Pattern
```javascript
// ✅ REQUIRED: Pluggable AI providers
class AIAdapter {
  async generateReview(code, context) {
    throw new Error('Not implemented');
  }
}

class GeminiAdapter extends AIAdapter {
  async generateReview(code, context) {
    // Gemini-specific implementation
  }
}

const adapters = {
  gemini: new GeminiAdapter(),
  openrouter: new OpenRouterAdapter(),
  github: new GitHubModelsAdapter()
};
```

## Project Structure

```
src/
├── index.js           # Entry point
├── adapters/          # AI provider adapters
│   ├── gemini.js
│   ├── openrouter.js
│   └── github.js
├── prompts/           # Prompt templates
├── github/            # GitHub API wrapper
└── utils/             # Utilities

action.yml            # Action metadata
```

## Key Features

### 1. Multi-Provider Support
- Google Gemini (default)
- OpenRouter (multi-model)
- GitHub Models

### 2. Adaptive Personas
- **roast**: Brutally honest, sarcastic
- **professional**: Senior engineer, detailed
- **funny**: Comedian-style, humorous
- **friendly**: Supportive mentor

### 3. Multi-Language
- Hinglish (Hindi + English)
- English
- Bengali (if supported)

### 4. Review Capabilities
- Auto PR title and description
- Smart label suggestions
- Line-by-line code analysis
- Security vulnerability detection
- Performance optimization
- Best practice recommendations

## Error Handling

```javascript
// ✅ REQUIRED: Exponential backoff for rate limits
async function callAI(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.generate(prompt);
    } catch (error) {
      if (error.status === 429) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}

// ✅ REQUIRED: Graceful degradation
try {
  await generateTitle();
} catch (error) {
  core.warning(`Title generation failed: ${error.message}`);
  // Continue with review even if title fails
}
```

## Input Validation

```javascript
// ✅ REQUIRED: Validate all inputs
const provider = core.getInput('ai-provider') || 'gemini';
const validProviders = ['gemini', 'openrouter', 'github'];
if (!validProviders.includes(provider)) {
  core.setFailed(`Invalid provider: ${provider}`);
  return;
}

const prNumber = parseInt(core.getInput('pr-number'), 10);
if (isNaN(prNumber) || prNumber < 1) {
  core.setFailed('Invalid PR number');
  return;
}
```

## Performance Standards

```javascript
// ✅ REQUIRED: Parallel operations
const reviews = await Promise.all(
  files.map(file => reviewFile(file))
);

// ❌ AVOID: Sequential operations
for (const file of files) {
  await reviewFile(file); // Slow
}

// ✅ REQUIRED: Timeout handling
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

## API Integration

### GitHub API
```javascript
const octokit = github.getOctokit(token);

// Fetch PR details
const { data: pr } = await octokit.rest.pulls.get({
  owner, repo, pull_number: prNumber
});

// Get changed files
const { data: files } = await octokit.rest.pulls.listFiles({
  owner, repo, pull_number: prNumber
});

// Post review
await octokit.rest.pulls.createReview({
  owner, repo, pull_number: prNumber,
  body: reviewComment,
  event: 'COMMENT',
  comments: inlineComments
});
```

### AI Providers
```javascript
// Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
const result = await model.generateContent(prompt);

// OpenRouter
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ model: 'gpt-4', messages })
});

// GitHub Models
// Use GitHub's model API endpoints
```

## Testing Standards

```javascript
// ✅ REQUIRED: Mock GitHub Actions
jest.mock('@actions/core');
jest.mock('@actions/github');

beforeEach(() => {
  core.getInput.mockClear();
  core.setOutput.mockClear();
  core.setFailed.mockClear();
});

test('should generate review', async () => {
  core.getInput.mockReturnValueOnce('gemini');
  const result = await generateReview(mockContext);
  expect(result).toHaveProperty('suggestions');
  expect(core.setFailed).not.toHaveBeenCalled();
});

test('should handle rate limit', async () => {
  api.generate.mockRejectedValueOnce({ status: 429 });
  api.generate.mockResolvedValueOnce('review');
  const result = await callAI('prompt');
  expect(result).toBe('review');
});
```

## Documentation Standards

### action.yml
```yaml
name: 'ReviewBuddy'
description: 'AI-powered code review'
inputs:
  github-token:
    description: 'GitHub token'
    required: true
  ai-provider:
    description: 'AI provider (gemini/openrouter/github)'
    required: false
    default: 'gemini'
  persona:
    description: 'Review persona (roast/professional/funny/friendly)'
    required: false
    default: 'professional'
outputs:
  review-result:
    description: 'Review result'
```

### README.md
- Usage examples for each provider
- Configuration options
- Persona descriptions
- Language support

## Anti-Patterns

### ❌ BAD: Hardcoded credentials
```javascript
const apiKey = 'AIzaSyXXX'; // NEVER
```

### ✅ GOOD: Environment-based
```javascript
const apiKey = core.getInput('gemini-api-key', { required: true });
core.setSecret(apiKey);
```

### ❌ BAD: Exposing errors
```javascript
console.log('Error:', error.stack); // Might contain secrets
```

### ✅ GOOD: Safe error logging
```javascript
core.error(`Failed: ${error.message}`);
core.setFailed(error.message);
```

### ❌ BAD: No retry logic
```javascript
const result = await api.call(); // Fails on transient errors
```

### ✅ GOOD: Exponential backoff
```javascript
const result = await retryWithBackoff(() => api.call(), 3);
```

## Completion Criteria

Before marking as "Done":
- [ ] Code follows adapter pattern
- [ ] All secrets masked with `core.setSecret()`
- [ ] Input validation implemented
- [ ] Error handling with `core.setFailed()`
- [ ] Rate limiting and retries
- [ ] Tests pass (if exist)
- [ ] README.md updated
- [ ] action.yml updated
- [ ] No hardcoded credentials
- [ ] Performance optimized (parallel ops)

## Environment Variables

```bash
# Required
GITHUB_TOKEN=ghp_xxx
GEMINI_API_KEY=AIzaSyXxx       # For Gemini
OPENROUTER_API_KEY=sk-xxx      # For OpenRouter
GITHUB_MODELS_TOKEN=ghp_xxx    # For GitHub Models

# Optional
LOG_LEVEL=debug
TIMEOUT_MS=60000
MAX_RETRIES=3
```

## Common Issues

### Rate Limit Exceeded
**Solution**: Implement exponential backoff, cache responses

### Invalid Token
**Solution**: Validate token with `octokit.rest.users.getAuthenticated()`

### Timeout
**Solution**: Set reasonable timeouts (30-60s), use streaming for large responses

### Poor Review Quality
**Solution**: Improve prompt engineering, adjust persona, fine-tune model

## Best Practices

1. **Security First**: Mask secrets, validate inputs, sanitize data
2. **Error Handling**: Use `core.setFailed()`, provide helpful messages
3. **Performance**: Parallel operations, timeouts, retries
4. **Modularity**: Adapter pattern, separate concerns
5. **Testing**: Mock external APIs, test error paths
6. **Documentation**: Update README and action.yml

## Summary

- GitHub Action for AI-powered code reviews
- Multi-provider support (Gemini, OpenRouter, GitHub Models)
- Adaptive personas (roast, professional, funny, friendly)
- Security: Mask secrets, validate inputs
- Performance: Parallel ops, retries, timeouts
- Pattern: Adapter for pluggable AI providers
