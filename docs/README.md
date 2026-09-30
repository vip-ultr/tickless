# Tickless docs

Planning, content and strategy documents for Tickless.

**Last updated:** 2026-09-29

These were written before the build and have been kept current with it. The
product is live and at **1.0.0** (2026-09-26). Anything describing *what*
shipped belongs in [CHANGELOG.md](../CHANGELOG.md), which is the record of every
change. These documents describe *why* the product is the way it is, what the
locked decisions were, and what to do next.

## Index

| Document | What it covers | Status | Written | Last updated |
| --- | --- | --- | --- | --- |
| [product-plan.md](./product-plan.md) | The master blueprint: brand and design identity, architecture and hosting, tech stack, UI/UX rules, feature scope, security, rate limiting, ads, admin panel, cost model, and the 26 locked decisions. | **Built.** Locked sections still govern the code; sections 2, 3, 6 and 8 describe the product as it stands. | 2026-07-27 | 2026-09-27 |
| [content.md](./content.md) | Every user-facing string: hero, how-it-works, FAQ, about, footer, legal gists, UI labels, error copy, PWA and consent strings. The build uses this verbatim. | **Reconciled** against the code. Section 12 lists what changed and what still needs a code fix. | 2026-07-27 | 2026-09-27 |
| [instagram-plan.md](./instagram-plan.md) | The multi-platform plan: platform registry, validation, download counters, copy sweep. | **Shipped.** Superseded in three places, flagged inline. | 2026-07-28 | 2026-09-27 |
| [clip-feature-plan.md](./clip-feature-plan.md) | The `/clip` feature: decisions, backend shape, frontend zones, verification, post-launch bug fixes. | **Shipped** in v0.5.0 (2026-08-13). | 2026-08-11 | 2026-09-27 |
| [clean-feature-plan.md](./clean-feature-plan.md) | The `/clean` feature: AI metadata stripping, the ExifTool traps it was built around, format matrix, legal framing, verification. | **Built, not yet shipped.** | 2026-09-29 | 2026-09-29 |
| [growth-strategy.md](./growth-strategy.md) | Search and AI discoverability: market teardown, on-page SEO, GEO/AEO, seeding, MCP integration, risks, timeline. | **Strategy, partly executed.** Read "Where this stands" first; the custom domain is still the blocking decision. | 2026-07-28 | 2026-09-27 |
| [legal-posture.md](./legal-posture.md) | Founder-level risk posture: platform enforcement vs litigation, data and privacy, rights-holder process, jurisdiction, pitch framing. | **Current.** Companion to the shipped `/terms`, `/privacy`, `/copyright` and `/dmca` pages. | 2026-08-01 | 2026-09-27 |

## How to keep these current

1. **Update the doc first, then the code.** If the site and these documents
   disagree, `content.md` wins for copy and the locked decisions in
   `product-plan.md` win for design. A divergence is a bug in whichever of the
   two is behind.
2. **Bump the "Last updated" date** on any document you change, in ISO 8601.
3. **Never delete a decision silently.** When a locked decision is overturned,
   mark the old line *(Superseded: ...)* and say what replaced it, so the
   reasoning is not lost.
4. **Feature plans do not get rewritten after shipping.** They become a record.
   Add a status header saying when it shipped and let `CHANGELOG.md` carry
   everything after that date.
5. **Anything that happened goes in `CHANGELOG.md`** under `[Unreleased]`
   until a version is cut.
