# SolveBeam Brand

The single source for the SolveBeam logo, icon, colours, typography and story. It also holds the brand site for [brand.solvebeam.com](https://brand.solvebeam.com/).

## Find a file

| You need | Look in |
|---|---|
| Logo, horizontal or stacked | [`assets/logo/`](assets/logo/) |
| Icon | [`assets/icon/`](assets/icon/) |
| Wordmark only | [`assets/wordmark/`](assets/wordmark/) |
| Favicons and app icons | [`assets/favicon/`](assets/favicon/) |
| Avatars and social images | [`assets/social/`](assets/social/) |
| Moneybird and Google Workspace sizes | [`assets/integrations/`](assets/integrations/) |
| Roboto font files | [`assets/fonts/`](assets/fonts/) |
| Colours and type as code | [`tokens/`](tokens/) |
| Original Inkscape files | [`source/inkscape/`](source/inkscape/) |

Every logo comes as SVG and as transparent PNG. Use `on-light` or `on-dark` for the full-colour logo, and `ink`, `black`, `white` or `orange` where fewer colours are needed.

## Brand basics

| | |
|---|---|
| Primary colour | Beam Orange `#fa4616` (Pantone 172 C) |
| Gradient | `#ff0000` → `#fab816`, top left to bottom right |
| Text | Ink `#1a1a1a` |
| Typeface | Roboto, with Roboto Bold for the wordmark |

Beam Orange reaches 3.5:1 on white, so use it for shapes and large text. Use Orange Deep `#c8360c` for links and small text on light backgrounds.

## Development

Requires Node.js 22.23.4 or newer.

```sh
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site locally |
| `npm run build` | Builds the site in `dist/` |
| `npm run preview` | Serves the built site |
| `npm run build:assets` | Regenerates `assets/` and `tokens/` |
| `npm run check:assets` | Checks sizes, transparency, SVG contents and colour contrast |

Do not edit `assets/` or `tokens/` by hand. The icon shape lives in `src/brand/geometry.js`, colours and type in `src/brand/tokens.js`, and the file variants in `scripts/build-assets.mjs`. After a change, run `npm run build:assets` and commit the result.

## Publishing

The site is prepared for GitHub Pages but not live yet. GitHub Pages needs a public repository on the Free plan, and the deploy workflow skips itself while this repository is private.

1. Make the repository public.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Add a DNS record: `brand.solvebeam.com` `CNAME` `solvebeam.github.io`.
4. In **Settings → Pages**, set the custom domain to `brand.solvebeam.com` and enable **Enforce HTTPS** once the certificate is ready.
5. Run the **Deploy site** workflow, or push to `main`.

## Usage

The code in this repository may be reused. The SolveBeam name, logo and icon remain the property of SolveBeam and are not covered by an open-source licence. They may be used to refer to SolveBeam, as described on the brand site. Roboto is licensed under the [SIL Open Font License](assets/fonts/LICENSE-Roboto.txt).
