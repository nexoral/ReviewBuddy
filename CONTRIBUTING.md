# Contributing to Review Buddy AI

Thank you for your interest in contributing to Review Buddy AI! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ReviewBuddy.git
   cd ReviewBuddy
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/nexoral/ReviewBuddy.git
   ```

## Development Setup

### Prerequisites

- Bash 4.0+
- `curl` and `jq` installed
- A Google Gemini API key for testing
- A GitHub repository to test against

### Project Structure

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

### Local Testing

1. Set the required environment variables:
   ```bash
   export GITHUB_TOKEN="your_github_token"
   export GEMINI_API_KEY="your_gemini_api_key"
   export GITHUB_REPOSITORY="owner/repo"
   export INPUT_PR_NUMBER="123"
   ```

2. Run the entrypoint script:
   ```bash
   ./entrypoint.sh
   ```

## Making Changes

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards below

3. **Test your changes** locally before submitting

4. **Commit your changes** with clear, descriptive messages following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add new feature description"
   git commit -m "fix: resolve issue with X"
   git commit -m "docs: update README with Y"
   ```

## Pull Request Process

1. **Update documentation** if your changes affect user-facing features

2. **Ensure your branch is up to date** with main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

3. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** against the `main` branch

5. **Fill out the PR template** completely

6. **Wait for review** - maintainers will review your PR and may request changes

7. **Address feedback** promptly and push additional commits as needed

## Coding Standards

### Shell Script Guidelines

- Use `#!/bin/bash` shebang
- Enable strict mode where appropriate: `set -euo pipefail`
- Use meaningful variable names in UPPER_CASE for globals, lower_case for locals
- Quote all variable expansions: `"${variable}"`
- Add comments for complex logic
- Keep functions focused and single-purpose
- Handle errors gracefully with informative messages

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or modifying tests
- `chore:` - Maintenance tasks

### Documentation

- Update README.md for user-facing changes
- Add inline comments for complex code
- Keep documentation clear and concise

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Environment details (OS, shell version, etc.)
- Relevant logs or error messages
- Screenshots if applicable

### Feature Requests

When requesting features, please include:

- A clear description of the feature
- The problem it solves or use case
- Proposed implementation (if any)
- Any alternatives you've considered

## Questions?

If you have questions about contributing, feel free to:

- Open a [GitHub Discussion](https://github.com/nexoral/ReviewBuddy/discussions)
- Check existing issues for similar questions
- Review the [SUPPORT.md](SUPPORT.md) file

Thank you for contributing to Review Buddy AI!
