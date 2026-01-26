# Review Buddy AI 🤖✨

**Review Buddy** is an intelligent, AI-powered GitHub Action that acts as your personal pair programmer. It doesn't just review your code—it **understands** it. 

### What does it do?
Review Buddy automates the boring parts of Code Review:
1.  **Code Quality & Comments**: It reviews your code line-by-line using AI to find bugs, security risks, and bad practices. (Note: It performs *static AI analysis*, it does **NOT** run your unit tests).
2.  **Smart Metadata Updates**:
    *   **PR Title**: Renames your PR to follow Conventional Commits (e.g., `fix: login bug` instead of `update`).
    *   **Description**: Writes a full, formatted description (Summary, Changes, Testing Guide) if you didn't provides one.
    *   **Labels**: Automatically adds relevant labels based on change type, quality score, and detected issues.
3.  **Engaging Feedback**: comments on your PR in your chosen tone (Professional or Roast).
4.  **Final Recommendation**: Provides a clear recommendation (Approve/Request Changes/Reject) with actionable next steps for reviewers.

---

## 🚀 Quick Start

Copy this into `.github/workflows/review_buddy.yml`:

```yaml
name: Review Buddy
on:
  pull_request_target:
    types: [opened, synchronize]
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
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

> **💰 Cost-Efficient**: Review Buddy makes only **ONE** Gemini API call per PR (using `gemini-2.0-flash-exp`) to generate the complete review report (code analysis, suggestions, description, labels, and recommendation). No expensive multi-call workflows—just fast, affordable AI reviews!

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
    -   *Any other language supported by Gemini.*

---

## 🛠 Inputs

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `github_token` | GitHub Token (use `secrets.GITHUB_TOKEN`) | No | `${{ github.token }}` |
| `gemini_api_key` | Your Google Gemini API Key | **Yes** | N/A |
| `tone` | The personality (`professional`, `funny`, `roast`, `friendly`) | No | `roast` |
| `language` | Language of the review (e.g., `english`, `hinglish`) | No | `hinglish` |
| `pr_number` | The PR number to process | No | Auto-detected |

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

### 3. Handling Forked PRs (Open Source)
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
A: Review Buddy uses an intelligent decision algorithm based on multiple factors:
- **REJECT**: If critical security issues are detected OR quality score is below 40/100
- **REQUEST CHANGES**: If high-severity security issues exist OR quality score is 40-59/100
- **APPROVE**: If quality score is 60+/100 and no critical/high security issues

The recommendation is posted as a final comment with detailed reasoning and next steps.

**Q: What does `@main` mean in `uses: ...@main`?**
A: It tells GitHub Actions to use the latest version of the code from the `main` branch. For production stability, you may want to use a specific tag (e.g., `@v1.0.0`) once released.

---

## ⚙️ Setup

1.  **Get a Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/) to create a free API key.
2.  **Add Secrets**: Go to your repository **Settings > Secrets and variables > Actions** and add `GEMINI_API_KEY`.
3.  **Add Workflow**: Copy one of the usage examples above into a new yaml file in `.github/workflows/`.

---

## 📂 Project Structure

Verified Source Code structure for contributors:

```
ReviewBuddy/
├── action.yml          # Action definition & metadata
├── entrypoint.sh       # Bootstrapper script
└── src/
    ├── main.sh         # Core logic orchestration
    ├── github.sh       # GitHub API interaction module
    ├── gemini.sh       # Gemini API interaction module
    └── utils.sh        # Shared utilities (logging, etc.)
```

## 🤝 Contributing

Contributions are welcome! Please ensure you:
1.  Fork the repo.
2.  Modify the scripts in `src/`.
3.  Test locally if possible.
4.  Submit a PR (Review Buddy will likely roast it!).

## 📄 License

MIT
