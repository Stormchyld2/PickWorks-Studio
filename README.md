# PickWorks Studio

Interactive, offline-first guitar learning software. Windows 10/11 first, Android later.

The first course is **Fretboard Foundations** (Fretboard Note Mastery). Everything runs locally: no accounts, ads, subscriptions or analytics.

## Stack

- [Tauri 2](https://v2.tauri.app/) desktop shell (Rust)
- Svelte 5 + SvelteKit (static SPA mode) + TypeScript (strict) + Vite
- Vitest for engine and logic tests

## Getting started

Prerequisites: Node 22+, Rust (stable), and on Windows the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2 and the MSVC build tools).

```bash
npm install
npm run tauri dev     # run the desktop app with hot reload
npm run dev           # frontend only, in a browser at http://localhost:1420
npm test              # engine tests
npm run check         # Svelte + TypeScript checks
npm run tauri build   # Windows installer (MSI and NSIS) in src-tauri/target/release/bundle
```

CI builds the Windows installer on every pull request; download it from the run's artifacts.

## Layout

```text
src/lib/engines/       pure TypeScript: music theory, fretboard, performance pipeline (no UI imports)
src/lib/components/    Svelte components (fretboard, navigation, ui)
src/lib/styles/        design tokens (approved palette) and base styles
src/routes/            one folder per screen
src-tauri/             Rust shell, app icons, Tauri config
branding/              approved logo and icon, unmodified source files
static/                files served to the app (branding copies, photos, favicon)
tests/                 Vitest tests
docs/                  architecture and decisions
```

See [docs/architecture.md](docs/architecture.md) for the design and roadmap.

## Branding

The logo and pick icon in `branding/` are final. Do not edit, redraw or replace them. App icons in `src-tauri/icons` are generated from `branding/pickworks-icon.png` with `npx tauri icon branding/pickworks-icon.png`.
