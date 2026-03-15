---
name: reviewbuddy-development
description: Core development rules for ReviewBuddy AI-powered code review GitHub Action
version: 1.0.0
tags: [javascript, github-action, ai, code-review, adapter-pattern]
author: ReviewBuddy Team
applies_to:
  - src/**/*.js
  - action.yml
  - package.json
triggers:
  - file_change
  - on_request
---

# ReviewBuddy Development Skill

## Project Context

**ReviewBuddy** - AI-powered code review GitHub Action with multi-provider support (Gemini, OpenRouter, GitHub Models).

## Technology Stack

- **Language**: JavaScript (Node.js ≥18.0.0)
- **Runtime**: GitHub Actions environment
- **Dependencies**: @actions/core, @actions/github, AI provider SDKs
- **Pattern**: Adapter pattern for pluggable AI providers

## Commands

```bash
npm install          # Install dependencies
npm test            # Run tests
npm run lint        # ESLint
node src/index.js   # Local testing (requires env vars)
```

## Definition of "Done"

- ✅ Code follows adapter pattern
- ✅ All secrets masked with `core.setSecret()`
- ✅ Input validation implemented
- ✅ Error handling with `core.setFailed()`
- ✅ Rate limiting and retries
- ✅ Tests pass (if exist)
- ✅ README.md updated
- ✅ action.yml updated
- ✅ No hardcoded credentials

## Critical Rules

### 1. Security (NON-NEGOTIABLE)

```javascript
// ✅ ALWAYS: Mask secrets in logs
const apiKey = core.getInput('gemini-api-key', { required: true });
core.setSecret(apiKey);

// ❌ NEVER: Log credentials
console.log(`Using API key: ${apiKey}`); // FORBIDDEN
```

### 2. GitHub Actions API Standards

```javascript
// ✅ Use @actions/core for inputs/outputs
const token = core.getInput('github-token', { required: true });
const provider = core.getInput('ai-provider') || 'gemini';
core.setOutput('review-result', result);

// ✅ Use core.setFailed for critical errors
try {
  await reviewPR(context, token);
} catch (error) {
  core.error(`Review failed: ${error.message}`);
  core.setFailed(error.message);
}
```

### 3. Adapter Pattern (REQUIRED)

```javascript
// ✅ GOOD: Pluggable AI providers
class AIAdapter {
  async generateReview(code, context) {
    throw new Error('Not implemented');
  }
  async generateTitle(diff, context) {
    throw new Error('Not implemented');
  }
  async suggestLabels(diff, context) {
    throw new Error('Not implemented');
  }
}

class GeminiAdapter extends AIAdapter {
  constructor(apiKey) {
    super();
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateReview(code, context) {
    const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

class OpenRouterAdapter extends AIAdapter {
  async generateReview(code, context) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'gpt-4', messages })
    });
    return await response.json();
  }
}

// Factory pattern
const adapters = {
  gemini: new GeminiAdapter(geminiKey),
  openrouter: new OpenRouterAdapter(openrouterKey),
  github: new GitHubModelsAdapter(githubToken)
};

const adapter = adapters[provider];
const review = await adapter.generateReview(code, context);
```

## Project Structure

```
src/
├── index.js              # Main entry point
├── adapters/             # AI provider adapters
│   ├── gemini.js         # Google Gemini
│   ├── openrouter.js     # OpenRouter
│   └── github.js         # GitHub Models
├── prompts/              # AI prompt templates
│   ├── review.js         # Code review prompts
│   ├── title.js          # PR title generation
│   └── label.js          # Label suggestion
├── github/               # GitHub API wrapper
│   ├── pr.js             # Pull request operations
│   ├── comments.js       # Comment handling
│   └── labels.js         # Label management
└── utils/                # Utilities
    ├── logger.js         # Logging
    ├── retry.js          # Retry logic with backoff
    └── validator.js      # Input validation

action.yml               # GitHub Action metadata
```

## Key Features

### 1. Multi-Provider AI Support
- Google Gemini (default, free tier)
- OpenRouter (multi-model, paid)
- GitHub Models (native GitHub)

### 2. Adaptive Personas
```javascript
const personas = {
  roast: "You are a brutally honest code reviewer who roasts bad code mercilessly...",
  professional: "You are a senior software engineer providing detailed technical analysis...",
  funny: "You are a comedian reviewing code with humor and wit...",
  friendly: "You are a supportive mentor providing encouraging feedback..."
};

const systemPrompt = personas[core.getInput('persona')] || personas.professional;
```

### 3. Multi-Language Support
- Hinglish (Hindi + English)
- English
- Bengali

### 4. Review Capabilities
- Auto PR title/description generation
- Smart label suggestions (bug, enhancement, documentation)
- Line-by-line code analysis
- Security vulnerability detection
- Performance optimization suggestions
- Best practice recommendations

## Error Handling Standards

### Rate Limiting with Exponential Backoff
```javascript
// ✅ REQUIRED
async function callAI(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.generate(prompt);
    } catch (error) {
      if (error.status === 429) {
        const backoff = Math.pow(2, i) * 1000;
        core.warning(`Rate limited. Retrying in ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Graceful Degradation
```javascript
// ✅ REQUIRED: Continue even if optional features fail
try {
  const title = await generateTitle(diff);
  await updatePRTitle(title);
} catch (error) {
  core.warning(`Title generation failed: ${error.message}`);
  // Continue with review even if title generation fails
}

const review = await generateReview(files); // Core feature
await postReview(review);
```

## Input Validation

```javascript
// ✅ REQUIRED: Validate all inputs
function validateInputs() {
  const token = core.getInput('github-token', { required: true });

  const provider = core.getInput('ai-provider') || 'gemini';
  const validProviders = ['gemini', 'openrouter', 'github'];
  if (!validProviders.includes(provider)) {
    throw new Error(`Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
  }

  const persona = core.getInput('persona') || 'professional';
  const validPersonas = ['roast', 'professional', 'funny', 'friendly'];
  if (!validPersonas.includes(persona)) {
    throw new Error(`Invalid persona: ${persona}`);
  }

  const prNumber = parseInt(core.getInput('pr-number'), 10);
  if (isNaN(prNumber) || prNumber < 1) {
    throw new Error('Invalid PR number');
  }

  return { token, provider, persona, prNumber };
}
```

## Performance Standards

### Parallel Operations
```javascript
// ✅ GOOD: Review files in parallel
const reviews = await Promise.all(
  files.map(file => reviewFile(file))
);

// ❌ BAD: Sequential operations
for (const file of files) {
  await reviewFile(file); // Slow
}
```

### Timeout Handling
```javascript
// ✅ REQUIRED: Set timeouts for AI calls
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000); // 60s

try {
  const response = await fetch(aiEndpoint, {
    signal: controller.signal,
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('AI request timed out after 60s');
  }
  throw error;
} finally {
  clearTimeout(timeout);
}
```

## GitHub API Integration

```javascript
// ✅ Standard GitHub API patterns
const octokit = github.getOctokit(token);

// Fetch PR details
const { data: pr } = await octokit.rest.pulls.get({
  owner: context.repo.owner,
  repo: context.repo.repo,
  pull_number: prNumber
});

// Get changed files
const { data: files } = await octokit.rest.pulls.listFiles({
  owner: context.repo.owner,
  repo: context.repo.repo,
  pull_number: prNumber
});

// Post review with inline comments
await octokit.rest.pulls.createReview({
  owner: context.repo.owner,
  repo: context.repo.repo,
  pull_number: prNumber,
  body: reviewSummary,
  event: 'COMMENT',
  comments: [
    {
      path: 'src/index.js',
      line: 42,
      body: 'Consider using const instead of let'
    }
  ]
});

// Add labels
await octokit.rest.issues.addLabels({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: prNumber,
  labels: ['bug', 'needs-review']
});
```

## Testing Standards

```javascript
// ✅ REQUIRED: Mock GitHub Actions
jest.mock('@actions/core');
jest.mock('@actions/github');

describe('ReviewBuddy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate review successfully', async () => {
    core.getInput.mockImplementation((name) => {
      const inputs = {
        'github-token': 'test-token',
        'ai-provider': 'gemini',
        'gemini-api-key': 'test-key'
      };
      return inputs[name];
    });

    const result = await generateReview(mockContext);

    expect(result).toHaveProperty('suggestions');
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setSecret).toHaveBeenCalledWith('test-key');
  });

  test('should handle rate limit with retry', async () => {
    const mockAPI = jest.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('review content');

    const result = await retryWithBackoff(mockAPI, 3);

    expect(mockAPI).toHaveBeenCalledTimes(2);
    expect(result).toBe('review content');
  });

  test('should validate inputs', () => {
    core.getInput.mockReturnValue('invalid-provider');

    expect(() => validateInputs()).toThrow('Invalid provider');
  });
});
```

## Documentation Standards

### action.yml Updates
```yaml
inputs:
  github-token:
    description: 'GitHub token for API access'
    required: true
  ai-provider:
    description: 'AI provider (gemini/openrouter/github)'
    required: false
    default: 'gemini'
  gemini-api-key:
    description: 'Google Gemini API key'
    required: false
  persona:
    description: 'Review persona (roast/professional/funny/friendly)'
    required: false
    default: 'professional'
  language:
    description: 'Output language (hinglish/english/bengali)'
    required: false
    default: 'english'
outputs:
  review-result:
    description: 'Review result summary'
  labels-suggested:
    description: 'Comma-separated suggested labels'
```

### README.md Updates
- Usage examples for each AI provider
- Configuration options table
- Persona descriptions and examples
- Language support matrix
- Troubleshooting section

## Anti-Patterns

### ❌ BAD: Hardcoded secrets
```javascript
const apiKey = 'AIzaSyXXX'; // NEVER DO THIS
```

### ✅ GOOD: Environment-based configuration
```javascript
const apiKey = core.getInput('gemini-api-key', { required: true });
core.setSecret(apiKey);
```

### ❌ BAD: Synchronous operations
```javascript
const reviews = [];
for (const file of files) {
  reviews.push(await reviewFile(file));
}
```

### ✅ GOOD: Parallel operations
```javascript
const reviews = await Promise.all(files.map(reviewFile));
```

### ❌ BAD: Exposing error details
```javascript
catch (error) {
  console.log('Error:', error); // May contain secrets
}
```

### ✅ GOOD: Safe error logging
```javascript
catch (error) {
  core.error(`Review failed: ${error.message}`);
  core.setFailed(error.message);
}
```

## Review Checklist

Before committing:
- [ ] Adapter pattern implemented correctly
- [ ] All API keys masked with `core.setSecret()`
- [ ] Input validation for all user inputs
- [ ] Error handling with `core.setFailed()`
- [ ] Rate limiting with exponential backoff
- [ ] Parallel operations for performance
- [ ] Timeout handling (30-60s)
- [ ] Tests pass
- [ ] README.md updated
- [ ] action.yml inputs/outputs documented
- [ ] No hardcoded credentials
- [ ] No breaking changes to action.yml schema

## Summary

- **Pattern**: Adapter pattern for pluggable AI providers
- **Security**: Mask secrets, validate inputs, sanitize data
- **Performance**: Parallel ops, timeouts, retries with backoff
- **Error Handling**: `core.setFailed()`, graceful degradation
- **Testing**: Mock @actions/core and @actions/github
- **Docs**: Update README and action.yml for all changes
