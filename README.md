# UnderstandMe

A toolkit for providers and their patients: eight guided psychology exercises, plain HTML/CSS/JS, no build step, no backend.

## Run it

Open `index.html`, or serve the folder: `python3 -m http.server`.
Unit tests (calc modules): `node --test js/*.test.js`

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing page: "What's on your mind?" guide, exercise index, how it works (catalog, groups and guide answers in `js/tools.js`) |
| `providers.html` | Provider setup in three steps: profile, packet builder, share link and message |
| `packet.html` | What a patient sees from a packet link: the ordered steps and a start button |
| `pricing.html`, `about.html`, `privacy.html`, `login.html` | Company pages. Pricing is placeholder copy from `js/pricing-data.js`; login is a profile entry point plus a clearly labelled non-functional preview form |
| `values-sort`, `avoidance-calculator`, `suds-tracker`, `wheel-of-life`, `decision-matrix`, `genogram`, `step-builder`, `week-builder` | The eight tools |

## Data model: export-only

No patient data is collected, stored, or transmitted by this site.

- Patients use a tool in their browser and print or save the results.
- A **provider profile** (name, credentials, practice, contact, optional note) brands the printed letterhead. It reaches a page by one of two routes:
  - saved on the provider's own device (`localStorage`, opt-in), or
  - encoded in an assignment link (`?p=...`). The link carries only the provider's details, never anything a patient enters, and the patient's browser does not store it.
- Profiles move between devices with Export/Import (JSON file).
- Some tools offer opt-in local autosave (Step Builder, Week Builder) and resume of an in-progress sort (Values Sort). That data stays in the browser it was entered in.

`js/provider.js` is the single seam for real accounts later: replace its load/save with an auth backend and the tools do not change. Patient-result dashboards would need a HIPAA-grade backend and are out of scope for this version.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the unit tests and checks the header/footer are in sync, then publishes the static site on every push to `main`.
One-time setup: in the repo go to Settings, Pages, Build and deployment, and set Source to "GitHub Actions". The site works from a project sub-path (all links are relative). Any static host works the same way: upload `*.html`, `css/`, `js/` and `images/`.

## Logo on printouts

A provider can upload a logo in the dashboard. It is shrunk in the browser to a tiny raster image (PNG, JPEG or WebP, 3,000 characters or less) so it can travel inside the assignment link. SVG and remote image URLs are rejected on purpose: a remote URL would make every patient's browser contact the provider's image host.

## Navigation and motion

- Header: an Exercises menu grouped by purpose, For Providers, Pricing, About, Provider sign in, and a "Find an exercise" button. A thin progress line shows reading position.
- After each exercise, a "What to try next" list suggests two follow-ups with a reason (`UM_NEXT` in `js/tools.js`).
- Page-to-page fades use the browser's cross-page View Transitions where supported and fall back to a soft fade elsewhere. All motion is switched off for visitors who prefer reduced motion.
- `404.html` gives a helpful way back.

## Flow and export

- **Packets:** `packet.html?p=<profile>&flow=wheel-of-life,values-sort` lists tools in order. Each tool page then shows a step bar and a "Next" panel (`js/flow.js`). Without a packet, tool pages suggest other exercises.
- **Save & share tray** (`js/export.js`): reads each tool's print sheet and offers print/PDF, copy as text, download .txt, and an email draft to the provider. Nothing is uploaded.
- **Header/footer** are stamped into every page by `python3 scripts/sync-chrome.py`. Edit them there, then re-run.

## Conventions

- Each tool splits copy (`js/<tool>-data.js`) from logic (`js/<tool>.js`) and scopes CSS by class prefix (`vs-`, `ac-`, `st-`, `wol-`, `dm-`, `gb-`, `sb-`, `wb-`).
- Print sheets carry a `data-um-letterhead` element filled from the provider profile; with no profile they show "UnderstandMe".
- Design tokens live at the top of `css/styles.css` (teal `#719CA8`, Cormorant Garamond + Inter), carried over from the Mindset Psychological Care identity. Site chrome and dashboard styles are in `css/um.css`.

## Known follow-ups

- Domain and trademark check for "UnderstandMe".
- Assignment links are not secret; do not put anything sensitive in the profile or note.
- Crisis copy is US-specific (988); localize before international use.
