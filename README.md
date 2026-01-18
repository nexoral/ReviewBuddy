# Review Buddy AI 🤖✨

**Review Buddy** is an AI-powered GitHub Action that acts as your personal pair programmer and code reviewer. It uses Google's Gemini models to analyze Pull Requests, providing constructive feedback, generating comprehensive descriptions, and suggesting better titles.

Depending on your mood, Review Buddy can be a **Professional Mentor** 🎓 or a **Roasting Prankster** 🤡 (great for team bonding!).
## 🚀 Features

-   **Code Quality Analysis**: Checks for bugs, security issues, and performance bottlenecks.
-   **Auto-Description**: Automatically writes a detailed PR description if yours is too short.
-   **Smart Title Suggestions**: Recommends Conventional Commit titles.
-   **Constructive Feedback**: Logical, context-aware comments.
-   **Multiple Tones**:
    -   `roast` (Default): A fun, "senior dev" persona that playfully roasts bad code.
    -   `professional`: Helpful, clean, and mentorship-focused.
    -   `funny`: Adds humor using emojis and light jokes.
    -   `friendly`: Encouraging and kind.
-   **Multi-Language Support**:
    -   `hinglish` (Default): A mix of Hindi and English (great for Indian dev teams!).
    -   `english`: Standard English.
    -   Any other language supported by Gemini.

## 🛠 Inputs

| Input | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `github_token` | GitHub Token (usually `secrets.GITHUB_TOKEN`) | **Yes** | N/A |
| `gemini_api_key` | Your Google Gemini API Key | **Yes** | N/A |
| `tone` | The personality of the reviewer (`professional`, `funny`, `roast`, `friendly`) | No | `roast` |
| `language` | Language of the review (e.g., `english`, `hinglish`, `hindi`) | No | `hinglish` |
| `pr_number` | The PR number to process | No | `${{ github.event.pull_request.number }}` |

## 📦 Usage

Create a workflow file in your repository (e.g., `.github/workflows/review-buddy.yml`):

### Basic Example (Default: Hinglish Roast 🔥)

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
        uses: AnkanSaha/ReviewBuddy@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

### Professional Mode Configuration

```yaml
      - name: Run Review Buddy
        uses: AnkanSaha/ReviewBuddy@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          tone: 'professional'
          language: 'english'
```

### Handling Forked PRs (Important!)

If you want this action to run on Pull Requests from **forks** (common in open source), you **MUST** use the `pull_request_target` event instead of `pull_request`.

The standard `pull_request` event has a read-only token for forks, meaning Review Buddy cannot post comments or update descriptions.

**Safe Configuration for Forks:**

```yaml
name: Review Buddy CI

on:
  pull_request_target: # Trigger on PRs from forks with write permission
    types: [opened, synchronize]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Note: We don't strictly need to checkout code for Review Buddy to work 
      # (since it fetches diffs via API), but it's good practice.

      - name: Run Review Buddy
        uses: AnkanSaha/ReviewBuddy@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

## ❓ FAQ

**Q: What does `@main` mean in `uses: AnkanSaha/ReviewBuddy@main`?**
A: This tells GitHub Actions to use the version of the code currently on the `main` branch. 
- You can use `@v1` to pin to a specific release tag (Recommended for stability).
- You can use `@main` to always get the latest updates (Good for testing).

## ⚙️ Setup

1.  **Get a Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/) to invoke an API key.
2.  **Add Secrets**: Go to your repository `Settings > Secrets and variables > Actions` and add `GEMINI_API_KEY`.
3.  **Add Workflow**: Copy the usage example above into `.github/workflows/review.yml`.

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
