# GitHub Copilot Instructions for ReviewBuddy

## Project Overview

**ReviewBuddy** - AI-powered code review GitHub Action
- **Language**: JavaScript (Node.js ≥18.0.0)
- **Type**: GitHub Action
- **Pattern**: Adapter pattern for multiple AI providers
- **Target**: Automated PR code reviews with multi-provider support

## Core Rules

### 1. Security-First
All API keys and tokens must be handled securely:
```javascript
// ✅ GOOD
const apiKey = core.getInput('gemini-api-key', { required: true });
core.setSecret(apiKey); // Masks in logs

// ❌ BAD
console.log(`Using API key: ${apiKey}`);
const hardcodedKey = 'AIzaSyXXX';
```

### 2. GitHub Actions API Standards
```javascript
// ✅ GOOD - Use @actions/core
const token = core.getInput('github-token', { required: true });
core.setOutput('review-result', result);

// ✅ GOOD - Use core.setFailed for errors
try {
  await reviewPR(context, token);
} catch (error) {
  core.error(`Review failed: ${error.message}`);
  core.setFailed(error.message);
}

// ❌ BAD
throw new Error('Failed'); // Action doesn't fail properly
process.exit(1); // Doesn't set action status
```

### 3. Adapter Pattern (MANDATORY)
Each AI provider must implement common interface:
```javascript
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
    const prompt = buildPrompt(code, context);
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
```

## Commands

```bash
npm install              # Install dependencies
npm test                # Run tests
npm run lint            # ESLint check
node src/index.js       # Local testing (requires env vars)

# Testing in real GitHub Action
git push  # Triggers workflow
```

## Architecture

```
GitHub PR Event
    ↓
src/index.js (Entry point)
    ↓
Parse Inputs (github-token, ai-provider, persona, etc.)
    ↓
Fetch PR Details (octokit.rest.pulls.get)
    ↓
Get Changed Files (octokit.rest.pulls.listFiles)
    ↓
Select AI Adapter (Gemini/OpenRouter/GitHub)
    ↓
Generate Review (adapter.generateReview)
    ↓
Post Review Comments (octokit.rest.pulls.createReview)
    ↓
Generate Title/Labels (if enabled)
    ↓
Update PR Metadata
```

## File Structure

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
```

## Key Features

### 1. Multi-Provider AI Support
- **Gemini**: Default, free tier, high quality
- **OpenRouter**: Multi-model access (GPT-4, Claude, etc.)
- **GitHub Models**: Native GitHub integration

### 2. Adaptive Personas
```javascript
const personas = {
  roast: {
    tone: 'sarcastic',
    systemPrompt: "You are a brutally honest code reviewer who roasts bad code..."
  },
  professional: {
    tone: 'formal',
    systemPrompt: "You are a senior software engineer providing detailed analysis..."
  },
  funny: {
    tone: 'humorous',
    systemPrompt: "You are a comedian reviewing code with wit..."
  },
  friendly: {
    tone: 'supportive',
    systemPrompt: "You are a supportive mentor providing encouraging feedback..."
  }
};
```

### 3. Multi-Language Support
- Hinglish (Hindi + English)
- English
- Bengali

### 4. Review Capabilities
- Auto-generated PR titles and descriptions
- Smart label suggestions (bug, enhancement, documentation)
- Line-by-line code analysis
- Security vulnerability detection
- Performance optimization suggestions
- Best practice recommendations

## Error Handling Standards

### Rate Limiting (CRITICAL)
```javascript
// ✅ REQUIRED: Exponential backoff
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

// ❌ BAD: No retry logic
const result = await api.call(); // Fails on transient errors
```

### Graceful Degradation
```javascript
// ✅ GOOD: Continue on non-critical failures
try {
  const title = await generateTitle(diff);
  await updatePRTitle(title);
} catch (error) {
  core.warning(`Title generation failed: ${error.message}`);
  // Continue with review even if title fails
}

const review = await generateReview(files); // Core feature
await postReview(review);
```

### Timeout Handling
```javascript
// ✅ REQUIRED: Set timeouts for API calls
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

## Input Validation

```javascript
// ✅ REQUIRED: Validate all inputs
function validateInputs() {
  const token = core.getInput('github-token', { required: true });

  const provider = core.getInput('ai-provider') || 'gemini';
  const validProviders = ['gemini', 'openrouter', 'github'];
  if (!validProviders.includes(provider)) {
    throw new Error(`Invalid provider: ${provider}. Must be: ${validProviders.join(', ')}`);
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
  files.map(file => reviewFile(file, adapter, context))
);

// ❌ BAD: Sequential (slow)
const reviews = [];
for (const file of files) {
  reviews.push(await reviewFile(file));
}
```

### Minimize API Calls
```javascript
// ✅ GOOD: Batch operations
const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number });
const { data: files } = await octokit.rest.pulls.listFiles({ owner, repo, pull_number });

// ❌ BAD: Multiple calls for same data
const pr = await octokit.rest.pulls.get(...);
const title = await octokit.rest.pulls.get(...); // Duplicate call
```

## GitHub API Integration

```javascript
// ✅ Standard patterns
const octokit = github.getOctokit(token);
const context = github.context;

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
      body: 'Consider using const instead of let here for immutability'
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

// Update PR title
await octokit.rest.pulls.update({
  owner: context.repo.owner,
  repo: context.repo.repo,
  pull_number: prNumber,
  title: generatedTitle
});
```

## Testing

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
});
```

## Documentation

Update when features change:
- **action.yml**: Add/modify inputs/outputs
- **README.md**: Usage examples, configuration, personas
- **Code comments**: JSDoc for public functions

## Success Criteria

- ✅ Code follows adapter pattern
- ✅ All secrets masked with `core.setSecret()`
- ✅ Input validation implemented
- ✅ Error handling with `core.setFailed()`
- ✅ Rate limiting and exponential backoff
- ✅ Parallel operations for performance
- ✅ Tests pass
- ✅ README.md updated
- ✅ action.yml updated
- ✅ No hardcoded credentials
- ✅ No breaking changes
