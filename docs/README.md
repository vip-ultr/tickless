# Tickless docs

Planning and content documents for Tickless. These were written before the build and are the source of truth for scope, design decisions, and site copy.

- [product-plan.md](./product-plan.md): the master product plan. Scope, architecture (FastAPI + yt-dlp on Render, Next.js on Vercel, Supabase ads), brand and design decisions, security, ad system and admin panel spec, and the locked decisions list.
- [content.md](./content.md): every line of site copy (hero, how it works, FAQ, about, legal, error states). Written before the code; the site renders this copy verbatim. No em dashes anywhere.

Rule of thumb: if the site and these docs disagree, the docs win for copy, and the plan's locked decisions win for design. Update the doc first, then the code.
