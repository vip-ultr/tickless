# Contributing to Tickless

Thanks for your interest in improving Tickless. This document explains how to
get set up and what we expect from contributions.

## Code of conduct

By participating, you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting started

1. Fork the repository and clone your fork.
2. Pick an issue or open one to discuss the change before large work.
3. Create a branch: `git checkout -b fix/short-description`.

### Backend

```bash
cd backend
uv venv && . .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm dev
```

## Before you open a pull request

- Run the build and lint locally:
  ```bash
  cd frontend && pnpm build && pnpm lint
  ```
- Keep commits focused and write clear messages.
- Update docs and legal pages if your change affects behaviour users see.
- Add a line to `CHANGELOG.md` under "Unreleased" if the change is user-facing.

## Pull requests

- Describe what changed and why.
- Link the related issue if there is one.
- CI must pass (build + lint) before review.

## Scope

Tickless is a small, focused product. We favour reliability and privacy over
feature breadth. Proposals that fit that direction are welcome; large
departures are best discussed in an issue first.

## Contact

Questions can go to `legal@tickless.app`.
