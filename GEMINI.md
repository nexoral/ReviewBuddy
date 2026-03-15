# ReviewBuddy - AI-Powered Code Review GitHub Action

## Overview
**ReviewBuddy** is a GitHub Action that provides AI-powered code reviews for pull requests with multi-provider support (Gemini, OpenRouter, GitHub Models).

## Technology Stack
- **Language**: JavaScript (Node.js ≥18.0.0)
- **Runtime**: GitHub Actions environment
- **Dependencies**: @actions/core, @actions/github, AI provider SDKs
- **Pattern**: Adapter pattern for pluggable AI providers

## Core Features

### 1. Multi-Provider AI Support
- **Google Gemini**: Default provider, high-quality reviews
- **OpenRouter**: Access to multiple models (GPT-4, Claude, etc.)
- **GitHub Models**: GitHub's AI models

### 2. Adaptive Personas
- **Roast**: Brutally honest, sarcastic feedback
- **Professional**: Senior engineer, detailed analysis
- **Funny**: Comedian-style reviews with humor
- **Friendly**: Supportive mentor, encouraging tone

### 3. Multi-Language Support
- **Hinglish**: Hindi + English mix
- **English**: Standard English
- **Bengali**: Bengali language (if supported)

### 4. Review Features
- Auto-generated PR titles and descriptions
- Smart label suggestions (bug, enhancement, documentation)
- Line-by-line code analysis
- Security vulnerability detection
- Performance optimization suggestions
- Best practice recommendations

## Project Structure

```
ReviewBuddy/
├── src/
│   ├── index.js              # Main entry point
│   ├── adapters/             # AI provider adapters
│   │   ├── gemini.js         # Google Gemini integration
│   │   ├── openrouter.js     # OpenRouter integration
│   │   └── github.js         # GitHub Models integration
│   ├── prompts/              # AI prompt templates
│   │   ├── review.js         # Code review prompts
│   │   ├── title.js          # PR title generation
│   │   └── label.js          # Label suggestion prompts
│   ├── github/               # GitHub API wrapper
│   │   ├── pr.js             # Pull request operations
│   │   ├── comments.js       # Comment management
│   │   └── labels.js         # Label operations
│   └── utils/                # Utilities
│       ├── logger.js         # Logging utilities
│       ├── retry.js          # Retry logic with backoff
│       └── validator.js      # Input validation
├── .github/workflows/        # CI/CD workflows
├── action.yml               # GitHub Action metadata
└── package.json             # Dependencies
```

## Key Design Patterns

### Adapter Pattern (AI Providers)
Each AI provider implements a common interface:
```javascript
class AIAdapter {
  async generateReview(code, context) {
    // Provider-specific implementation
  }
  async generateTitle(diff, context) {
    // Provider-specific implementation
  }
  async suggestLabels(diff, context) {
    // Provider-specific implementation
  }
}
```

### Strategy Pattern (Personas)
Different review styles based on persona:
```javascript
const personas = {
  roast: { tone: 'sarcastic', brutality: 'high' },
  professional: { tone: 'formal', detail: 'high' },
  funny: { tone: 'humorous', jokes: 'enabled' },
  friendly: { tone: 'supportive', encouragement: 'high' }
};
```

## Configuration (action.yml inputs)

### Required Inputs
- `github-token`: GitHub token for API access
- `ai-provider`: AI provider (gemini/openrouter/github)
- `api-key`: API key for selected provider

### Optional Inputs
- `persona`: Review style (roast/professional/funny/friendly)
- `language`: Output language (hinglish/english/bengali)
- `auto-title`: Auto-generate PR title (true/false)
- `auto-labels`: Auto-suggest labels (true/false)
- `comment-mode`: inline/summary/both
- `min-confidence`: Minimum confidence for suggestions (0-100)

## Data Flow

```
1. GitHub PR Event Triggered
   ↓
2. Action Starts → Parse Inputs
   ↓
3. Fetch PR Details (files, diff, context)
   ↓
4. Select AI Adapter (Gemini/OpenRouter/GitHub)
   ↓
5. Generate Review Prompt (with persona + language)
   ↓
6. Call AI Provider API
   ↓
7. Parse AI Response
   ↓
8. Post Review Comments to GitHub
   ↓
9. Generate Title/Labels (if enabled)
   ↓
10. Update PR metadata
```

## API Integration Points

### GitHub API
- `octokit.rest.pulls.get()`: Fetch PR details
- `octokit.rest.pulls.listFiles()`: Get changed files
- `octokit.rest.pulls.createReview()`: Post review
- `octokit.rest.issues.addLabels()`: Add labels
- `octokit.rest.pulls.update()`: Update title

### AI Provider APIs
- **Gemini**: `generativeai.GenerativeModel.generateContent()`
- **OpenRouter**: POST `https://openrouter.ai/api/v1/chat/completions`
- **GitHub Models**: GitHub's model API endpoints

## Critical Considerations

### 1. Security
- Never log API keys or tokens
- Sanitize user inputs before sending to AI
- Validate GitHub token permissions
- Use `core.setSecret()` to mask secrets in logs

### 2. Rate Limiting
- Implement exponential backoff for API retries
- Handle 429 (Too Many Requests) gracefully
- Batch operations when possible
- Set reasonable timeouts (30-60s)

### 3. Error Handling
- Use `core.setFailed()` for critical errors
- Provide helpful error messages
- Log errors with `core.error()`
- Graceful degradation (e.g., skip title if review fails)

### 4. Performance
- Use `Promise.all()` for parallel file reviews
- Stream large AI responses
- Minimize GitHub API calls
- Cache when appropriate

## Testing Strategy

### Unit Tests
- Mock `@actions/core` and `@actions/github`
- Test each adapter independently
- Validate prompt generation
- Test error handling

### Integration Tests
- Test with real GitHub API (in test repo)
- Validate AI provider responses
- Test full review workflow
- Verify label and title generation

### E2E Tests
- Deploy to test repository
- Create test PRs with known issues
- Verify action runs successfully
- Check review quality

## Environment Variables

```bash
# Required
GITHUB_TOKEN=ghp_xxx
GEMINI_API_KEY=AIzaSyXxx       # If using Gemini
OPENROUTER_API_KEY=sk-xxx      # If using OpenRouter
GITHUB_MODELS_TOKEN=ghp_xxx    # If using GitHub Models

# Optional
LOG_LEVEL=debug
TIMEOUT_MS=60000
MAX_RETRIES=3
```

## Commands

```bash
# Development
npm install
npm test
npm run lint

# Local testing (requires env vars)
export GITHUB_TOKEN=xxx
export GEMINI_API_KEY=xxx
node src/index.js

# GitHub Actions testing
git push  # Triggers workflow
```

## Best Practices

### Code Review Prompts
- Include file context (language, framework)
- Specify review focus (security, performance, style)
- Request actionable suggestions
- Ask for code examples in feedback

### GitHub Integration
- Use review comments (not issue comments)
- Link suggestions to specific lines
- Use suggestion blocks for code changes
- Respect PR author's style

### AI Provider Selection
- **Gemini**: Best for general reviews, free tier available
- **OpenRouter**: Multi-model support, paid
- **GitHub Models**: Native GitHub integration

## Common Issues and Solutions

### Issue: Rate limit exceeded
**Solution**: Implement exponential backoff, reduce API calls

### Issue: AI response too long
**Solution**: Chunk files, use streaming, summarize

### Issue: Invalid GitHub token
**Solution**: Validate token permissions (repo, pull_request)

### Issue: Poor review quality
**Solution**: Improve prompts, adjust persona, fine-tune model

## Future Enhancements
- Support for more AI providers (Claude, GPT-4)
- Custom prompt templates
- Review history tracking
- Performance metrics dashboard
- Multi-file context awareness
- Auto-fix suggestions
