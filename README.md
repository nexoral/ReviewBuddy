# Review Buddy AI 🤖✨

> **🆕 New Feature:** You can now **CHAT** with Review Buddy! Just reply to any comment with `/buddy` to ask questions or debate the review. 💬

**Review Buddy** is an intelligent, AI-powered GitHub Action that acts as your personal pair programmer. It doesn't just review your code—it **understands** it. 

### What does it do?
Review Buddy automates the boring parts of Code Review:
1.  **Code Quality & Comments**: It reviews your code line-by-line using AI to find bugs, security risks, and bad practices. (Note: It performs *static AI analysis*, it does **NOT** run your unit tests).
2.  **Smart Metadata Updates**:
    *   **PR Title**: Renames your PR to follow Conventional Commits (e.g., `fix: login bug` instead of `update`).
    *   **Description**: Writes a full, formatted description (Summary, Changes, Testing Guide) if you didn't provides one.
    *   **Labels**: Automatically adds relevant labels based on change type, quality score, and detected issues.
3.  **Best Practices Suggestions**: Identifies code patterns that can be improved with modern best practices (e.g., `if (a == undefined)` → `if (!a)`, using `const/let` instead of `var`, arrow functions, template literals, etc.) with before/after examples.
4.  **Engaging Feedback**: comments on your PR in your chosen tone (Professional or Roast).
5.  **Final Recommendation**: Provides a clear recommendation (Approve/Request Changes/Reject) with actionable next steps for reviewers.
6.  **Interactive Chat**: Reply to any comment with `/Buddy` (e.g., "Why is this wrong? /Buddy") and Review Buddy will explain!

---

## 🚀 Quick Start

Copy this into `.github/workflows/review_buddy.yml`:

```yaml
name: Review Buddy
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]
permissions:
    pull-requests: write
    contents: read
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nexoral/ReviewBuddy@main
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

> **💰 Cost-Efficient**: Review Buddy makes only **ONE** AI API call per PR to generate the complete review report (code analysis, suggestions, description, labels, and recommendation). No expensive multi-call workflows—just fast, affordable AI reviews!
>
> **🔌 Multi-Provider**: Supports **Gemini** (default) and **OpenRouter** (access 100+ models). Bring your own API key and model!
>
> **🚀 Simple & Smart**: Just add one API key with a small config file, and your Repo PR becomes smarter!

## 💡 Why I Built This

Let's be honest—writing PR descriptions is boring. We often push code with titles like "update" and leave the description empty, forcing reviewers to dig through files to guess what's happening.

I built **Review Buddy** to solve this:
*   **Context is King**: It forces every PR to have a clear, descriptive summary so reviewers know *exactly* what they are looking at immediately.
*   **Standardization**: It enforces clean titles and robust descriptions without any manual user effort.
*   **Decision Support**: Reviewers no longer have to wonder "should I approve this?" - Review Buddy provides clear, data-driven recommendations.
*   **Fun Factor**: Code reviews can be dry. Adding a "Hinglish Roast" mode makes the process engaging and bringing the team closer together through humor.

---

## 🚀 Features

-   **📝 Auto-Documentation**: Automatically writes a detailed PR description (Summary + Changes + Testing) if the original is lacking.
-   **🏷️ Smart Retitling**: Detects the nature of changes and renames the PR to be semantic (e.g., `fix:`, `feat:`, `chore:`).
-   **🏷️ Intelligent Label Management**: Automatically adds relevant labels based on:
    -   **Change Type**: `enhancement` (feat), `bug` (fix), `documentation` (docs), `testing` (test), `maintenance` (chore/ci/build)
    -   **Quality Score**: `good first review` (90+), `needs work` (<50)
    -   **Security Concerns**: `security` (if Critical/High issues detected)
    -   **Performance Issues**: `performance` (if optimization opportunities found)
-   **💡 Best Practices Suggestions**: Identifies code patterns that can be improved:
    -   Loose equality checks (`==`) → Strict equality (`===`)
    -   `if (a == undefined)` → `if (!a)` or `if (a === undefined)`
    -   `var` declarations → `const` or `let`
    -   Traditional functions → Arrow functions (where appropriate)
    -   Manual string concatenation → Template literals
    -   Callback hell → `async/await` or Promises
    -   For loops → Modern array methods (`map`, `filter`, `reduce`)
    -   Each suggestion includes before/after code examples with explanations
-   **🎯 Smart PR Recommendations**: Posts a final recommendation comment with:
    -   **✅ APPROVE**: High quality code (80+), no critical issues - ready to merge
    -   **⚠️ REQUEST CHANGES**: Medium quality (40-79) or some concerns - needs improvements
    -   **🚫 REJECT**: Critical security issues or very low quality (<40) - major fixes required
    -   Includes reasoning, review checklist, and clear next steps for reviewers
-   **💬 Adaptive Persona**:
    -   `roast` (Default): A fun, "senior dev" persona that playfully roasts bad code.
    -   `professional`: Helpful, clean, and mentorship-focused.
    -   `funny`: Adds humor using emojis and light jokes.
    -   `friendly`: Encouraging and kind.
-   **🌐 Multi-Language Support**:
    -   `hinglish` (Default): A mix of Hindi and English (Perfect for Indian dev teams!).
    -   `english`: Standard Professional English.
    -   *Any other language supported by the AI model.*
-   **🔌 Multi-Provider Support**:
    -   `gemini` (Default): Google Gemini API (`gemini-3-flash-preview` by default).
    -   `openrouter`: Access 100+ models via OpenRouter (Claude, GPT, Llama, Mistral, etc.).
    -   `github-models`: Use GitHub Models API with access to OpenAI, Meta, Mistral models and more.

---

## 🛠 Inputs

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `github_token` | GitHub Token (use `secrets.GITHUB_TOKEN`) | No | `${{ github.token }}` |
| `gemini_api_key` | Google Gemini API Key (required for `gemini` adapter) | Conditional | N/A |
| `adaptive_api_token` | Generic API Token for OpenRouter or GitHub Models | Conditional | N/A |
| `adapter` | AI provider (`gemini`, `openrouter`, or `github-models`) | No | `gemini` |
| `model` | Model name (optional - smart defaults for each adapter) | No | See below |
| `tone` | The personality (`professional`, `funny`, `roast`, `friendly`) | No | `roast` |
| `language` | Language of the review (e.g., `english`, `hinglish`) | No | `hinglish` |
| `pr_number` | The PR number to process | No | Auto-detected |

**Default Models:**
- `gemini`: `gemini-3-flash-preview`
- `openrouter`: `openrouter/auto` (auto-selects best free/cheap model)
- `github-models`: `openai/gpt-4o`

**Required Permissions**
To function correctly, the `github_token` needs specific permissions. If using the default `GITHUB_TOKEN`, ensure your workflow YAML includes:

```yaml
permissions:
  pull-requests: write  # Allowed to comment and update PR body/title
  contents: read        # Allowed to read the code diff
```

### Token Permissions Guide

**Option 1: Using the Default `GITHUB_TOKEN` (Recommended)**
Simply add this permissions block to your workflow file:
```yaml
permissions:
  pull-requests: write  # Allows commenting & editing PR details
  contents: read        # Allows reading the code diff
```

**Option 2: Creating a Personal Access Token (PAT)**
If you choose to use a PAT instead, follow these settings when creating it:

*   **Classic Token**:
    *   Check **[x] `repo`** (Full control of private repositories) or **[x] `public_repo`**.
*   **Fine-grained Token** (More Secure):
    *   **Repository Access**: Select target repositories.
    *   **Permissions**:
        *   **Pull Requests**: `Read and Write`
        *   **Contents**: `Read-only`

---

## 📦 Usage

Create a workflow file in your repository at `.github/workflows/review-buddy.yml`.

### 1. Standard Configuration
*Best for internal teams who want a mix of utility and fun.*

```yaml
name: Review Buddy CI

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          # Defaults: tone='roast', language='hinglish'
```

### 2. Professional Configuration
*Best for open-source or strict business environments.*

```yaml
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          tone: 'professional'
          language: 'english'
```

### 3. Custom Gemini Model
*Use a specific Gemini model.*

```yaml
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          model: 'gemini-2.5-pro'
```

### 4. OpenRouter Configuration
*Use any model via OpenRouter (Claude, GPT, Llama, Mistral, etc.).*

> **🎯 Smart Default:** If you don't specify a model, Review Buddy uses `openrouter/auto` which automatically selects the best free or cheap model for your request!

> **⚠️ Important - Model Selection:**
> - **Recommended models**: `anthropic/claude-3.5-sonnet`, `google/gemini-2.0-flash-exp:free`, `openai/gpt-4o-mini`, `meta-llama/llama-3.3-70b-instruct`
> - **Avoid very small models** (< 7B parameters) - they cannot follow complex JSON structures
> - Small models may return errors, shallow reviews, and fail to update PR titles/descriptions

**With automatic model selection:**
```yaml
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          adapter: 'openrouter'
          adaptive_api_token: ${{ secrets.OPENROUTER_API_KEY }}
          tone: 'roast'
          language: 'hinglish'
          # model is optional - will use openrouter/auto
```

**With specific model:**
```yaml
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          adapter: 'openrouter'
          adaptive_api_token: ${{ secrets.OPENROUTER_API_KEY }}
          model: 'anthropic/claude-3.5-sonnet'
          tone: 'professional'
          language: 'english'
```

### 5. GitHub Models Configuration
*Use GitHub Models API with your GitHub token. Access OpenAI GPT, Meta Llama, and more!*

> **🆕 New Feature:** GitHub Models provides access to cutting-edge AI models directly through your GitHub token. No separate API key needed!
> 
> **🎯 Smart Default:** Uses `openai/gpt-4o` by default - the best balance of quality and speed!

**With default model (gpt-4o):**
```yaml
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          adapter: 'github-models'
          adaptive_api_token: ${{ secrets.GITHUB_TOKEN }}
          tone: 'roast'
          language: 'hinglish'
          # model is optional - will use openai/gpt-4o
```

**With specific model:**
```yaml
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          adapter: 'github-models'
          adaptive_api_token: ${{ secrets.GITHUB_TOKEN }}
          model: 'openai/gpt-5'
          tone: 'roast'
          language: 'hinglish'
```

**Available Models:**
- `openai/gpt-5` - Latest OpenAI (Recommended for best quality)
- `openai/gpt-4o` - Default, excellent balance (⭐ Default)
- `openai/gpt-4o-mini` - Fast and efficient
- `meta-llama/llama-3.3-70b-instruct` - Open source, powerful
- `mistralai/mistral-large` - Great for code

> **💡 Tip:** You can use the default `GITHUB_TOKEN` or create a personal access token from your [GitHub Settings > Developer settings > Tokens](https://github.com/settings/tokens).

### 6. Handling Forked PRs (Open Source)
**Important**: PRs from forks have read-only permissions by default. To allow Review Buddy to comment and update descriptions on forked PRs, use `pull_request_target`.

```yaml
name: Review Buddy CI

on:
  pull_request_target: # Required for Fork support
    types: [opened, synchronize]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Review Buddy
        uses: nexoral/ReviewBuddy@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

---

## ❓ FAQ

**Q: Why did it change my PR Title?**
A: Review Buddy detected that your title didn't match the content of your code (or was too generic). It uses AI to generate a Conventional Commit title so your git history remains clean.

**Q: What labels does Review Buddy add automatically?**
A: Review Buddy intelligently adds labels based on the PR analysis:
- **Change Type**: `enhancement`, `bug`, `documentation`, `testing`, `maintenance`
- **Quality**: `good first review` (high quality), `needs work` (low quality)
- **Concerns**: `security`, `performance`

Note: Labels must already exist in your repository. Review Buddy will skip labels that don't exist.

**Q: What if the labels don't exist in my repository?**
A: Review Buddy will gracefully skip labels that don't exist. To use this feature fully, create the following labels in your repository:
- `enhancement`, `bug`, `documentation`, `testing`, `maintenance`
- `good first review`, `needs work`
- `security`, `performance`

**Q: How does Review Buddy decide whether to recommend Approve, Request Changes, or Reject?**
A: Review Buddy uses AI-driven verdict determination. Gemini analyzes the code and returns a structured verdict that considers:
- The **perspective and purpose** of the changes (e.g., config/docs changes are judged leniently, auth/security PRs are judged strictly)
- Whether security issues are **real and exploitable**, not just theoretical
- The overall code quality, maintainability, and risk

The recommendation is posted as a final comment with detailed reasoning and next steps.

**Q: Can I dispute Review Buddy's verdict?**
A: Yes! Reply with `/buddy` and explain your reasoning (e.g., "/buddy this is a config-only change, the security concerns don't apply here"). Review Buddy will re-evaluate the verdict based on your explanation and the full conversation context, and **update the original recommendation comment** if warranted.

**Q: What does `@main` mean in `uses: ...@main`?**
A: It tells GitHub Actions to use the latest version of the code from the `main` branch. For production stability, you may want to use a specific tag (e.g., `@v1.0.0`) once released.

---

## ⚙️ Setup

**For Gemini (Default):**
1.  **Get a Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/) to create a free API key.
2.  **Add Secrets**: Go to your repository **Settings > Secrets and variables > Actions** and add `GEMINI_API_KEY`.
3.  **Add Workflow**: Copy one of the usage examples above into a new yaml file in `.github/workflows/`.

**For OpenRouter:**
1.  **Get an OpenRouter API Key**: Visit [OpenRouter](https://openrouter.ai/) and create an API key.
2.  **Add Secrets**: Add `OPENROUTER_API_KEY` to your repository secrets (or use `ADAPTIVE_API_TOKEN` for a generic approach).
3.  **Add Workflow**: Use the OpenRouter configuration example above, setting `adapter: 'openrouter'` and your preferred `model`.

**For GitHub Models:**
1.  **Get GitHub Token**: Your repository already has `GITHUB_TOKEN` available, or create a Personal Access Token from [GitHub Settings](https://github.com/settings/tokens).
2.  **Add Secrets** (optional): If using a custom token, add it as `GITHUB_TOKEN` or `ADAPTIVE_API_TOKEN` to your repository secrets.
3.  **Add Workflow**: Use the GitHub Models configuration example above, setting `adapter: 'github-models'` and your preferred `model`.

---

## 📂 Project Structure

Verified Source Code structure for contributors:

```
ReviewBuddy/
├── action.yml                      # GitHub Action definition & metadata
├── VERSION                         # Current version tracker
├── LICENSE                         # MIT License
├── README.md                       # Documentation
├── CODE_OF_CONDUCT.md              # Community guidelines
├── CONTRIBUTING.md                 # Contribution guidelines
├── SECURITY.md                     # Security policy
├── SUPPORT.md                      # Support documentation
├── src/
│   ├── index.js                    # Entry point & orchestration logic
│   ├── github/
│   │   └── index.js                # GitHub API interactions (PR, comments, labels)
│   ├── utils/
│   │   └── index.js                # Utilities (logging, scoring, recommendations)
│   ├── prompts/
│   │   ├── reviewPrompt.js         # PR review prompt text (provider-agnostic)
│   │   └── chatPrompt.js           # Chat reply prompt text (provider-agnostic)
│   └── adapters/
│       ├── index.js                # Adapter registry & factory
│       ├── geminiAdapter.js        # Google Gemini API adapter
│       ├── openrouterAdapter.js    # OpenRouter API adapter
│       └── githubModelsAdapter.js  # GitHub Models API adapter
└── .github/
    ├── FUNDING.yml                 # GitHub Sponsors configuration
    ├── pull_request_template.md    # PR template
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md           # Bug report template
    │   └── feature_request.md      # Feature request template
    └── workflows/
        ├── review_buddy.yml        # ReviewBuddy CI workflow
        └── auto-release.yml        # Automated release on version bump
```

## 🤝 Contributing

Contributions are welcome! Please ensure you:
1.  Fork the repo.
2.  Modify the scripts in `src/`.
3.  Test locally if possible.
4.  Submit a PR (Review Buddy will likely roast it!).

## 📄 License

MIT
