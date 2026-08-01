# Security Policy

## Supported versions

Tickless is under active development. Security fixes land on the `main`
branch and are deployed automatically. We support only the latest commit on
`main`.

## Reporting a vulnerability

If you discover a security issue in Tickless, please report it privately
rather than opening a public issue.

- Email: **legal@tickless.app** with the subject `Security disclosure`.
- Include a description, steps to reproduce, and any proof-of-concept.

We will acknowledge receipt within 5 business days and aim to provide a
remediation timeline within 14 business days for confirmed issues.

## Scope

In scope:
- The Tickless frontend and backend source in this repository.
- The deployed services at tickless.vercel.app and the backend host.

Out of scope:
- The behaviour of third-party platforms (TikTok, Instagram) whose content
  Tickless retrieves.
- Third-party services we depend on (Vercel, Render, Supabase, Cobalt).

## Good-faith research

We welcome responsible disclosure and will not pursue reports made under
good faith that follow this policy. Please do not access or modify data that
does not belong to you.

## Secrets

This repository never stores live credentials. Real secrets live in the
deployment providers (Vercel, Render) and are referenced via environment
variables. If you believe a secret has leaked, report it immediately using
the address above.
