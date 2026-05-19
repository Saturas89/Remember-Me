# Contributing to Storyhold

Thank you for your interest in contributing to Storyhold.

Storyhold is a privacy-first and offline-first family storytelling platform focused on preserving memories, stories, and family knowledge in an open and transparent way.

Please note that all contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- Bug reports
- UX feedback
- Accessibility improvements
- Documentation
- Translations
- Tests
- Feature ideas
- Pull requests

## Development Setup

```bash
git clone https://github.com/Saturas89/storyhold.git
cd storyhold
npm install

npm run dev          # Start dev server (Vite)
npm test             # Run unit tests (Vitest)
npm run test:e2e     # Run end-to-end tests (Playwright)
```

The dev server runs at `http://localhost:5173` by default.

## Development principles

- Privacy-first
- Accessibility matters
- Offline-first where possible
- Keep dependencies minimal
- Prefer transparent and understandable solutions
- Respect family and personal data

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add timeline export
fix: correct date formatting in story card
docs: update FAQ entry
refactor: simplify audio recording hook
test: add unit tests for share flow
```

## Pull Requests

Please:

1. Open an issue first for larger changes
2. Keep PRs focused and small
3. Add tests when appropriate
4. Ensure CI passes (`npm test` and the Playwright matrix)
5. Explain the user impact in the PR description

## Code style

- Follow the existing project conventions
- Prefer readability over cleverness
- Avoid unnecessary abstractions

## License

By contributing to Storyhold, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) that covers this project. This ensures the project and all derivative works remain open source.

## Security

Please do not disclose security issues publicly.

See [SECURITY.md](SECURITY.md) for responsible disclosure information.
