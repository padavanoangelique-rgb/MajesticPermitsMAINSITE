# Majestic Permits — Landing Page

Single-file static site (`index.html`) for majesticpermits.com. No build step, no dependencies — just HTML/CSS/JS in one file, with fonts loaded from Google Fonts.

## Deploy

**GitHub Pages**
1. Push this repo to GitHub.
2. Repo Settings → Pages → Deploy from branch → `main` / root.
3. Point `majesticpermits.com` at GitHub Pages via a `CNAME` file (add a file named `CNAME` containing `majesticpermits.com`) and set the DNS records GitHub gives you.

**Vercel / Netlify**
1. Import this repo.
2. No framework, no build command, output directory = root (`/`).
3. Add `majesticpermits.com` as a custom domain and point DNS at it.

## Notes

- The "Client Login" links point to `https://hub.majesticpermits.com` (the client portal) — that's a separate site and isn't touched by this repo.
- Update `angelique@majesticpermits.com` / `(305) 555-0100` in `index.html` if contact details change.
