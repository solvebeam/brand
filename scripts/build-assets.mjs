/**
 * Generates every logo file in assets/ and the design tokens in tokens/.
 * Run with `npm run build:assets`. The output is committed, so a logo is always at hand.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { gradient as iconGradient, iconPath } from '../src/brand/geometry.js';
import { color, colors, gradient, hexToRgb, rgbToHsl, typography } from '../src/brand/tokens.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const ink = color('ink').hex;
const orange = color('orange').hex;
const white = color('white').hex;
const black = '#000000';

const round = (value) => String(Number(value.toFixed(3)));

/*
 * Icon geometry. The grid drawing is rotated 45° and scaled by 1/√2 around (450,450), which is
 * matrix(.5 .5 -.5 .5 450 0). Baking that into the coordinates keeps the SVGs free of transforms.
 * The result is moved so that grid cell B2 becomes the origin: a 700 × 700 icon square.
 */
const ICON_SIZE = 700;
const ICON_TOP = 73.223; // Empty band above and below the icon inside its square.
const ICON_HEIGHT = ICON_SIZE - 2 * ICON_TOP;

const place = (x, y) => [0.5 * x - 0.5 * y + 450 - 100, 0.5 * x + 0.5 * y - 100];

function buildIconPath(offsetX = 0, offsetY = 0, scale = 1) {
	const tokens = iconPath.match(/[MAHVZ]|-?\d+(?:\.\d+)?/g);
	const output = [];
	let x = 0;
	let y = 0;
	let index = 0;
	const next = () => Number(tokens[index++]);
	const point = () => {
		const [px, py] = place(x, y);

		return `${round(px * scale + offsetX)} ${round(py * scale + offsetY)}`;
	};

	while (index < tokens.length) {
		const command = tokens[index++];

		if (command === 'M') {
			x = next();
			y = next();
			output.push(`M${point()}`);
		} else if (command === 'H') {
			x = next();
			output.push(`L${point()}`);
		} else if (command === 'V') {
			y = next();
			output.push(`L${point()}`);
		} else if (command === 'A') {
			const radius = next() * Math.SQRT1_2 * scale;

			next(); // The second radius is identical: all arcs are circular.
			next(); // Rotation has no effect on a circle.

			const large = next();
			const sweep = next();

			x = next();
			y = next();
			output.push(`A${round(radius)} ${round(radius)} 0 ${large} ${sweep} ${point()}`);
		} else {
			output.push('Z');
		}
	}

	return output.join('');
}

/** The gradient runs along the rotated grid axis, from the left tip towards the bottom right. */
function gradientDefinition(id, offsetX = 0, offsetY = 0, scale = 1) {
	const [x1, y1] = place(iconGradient.x1, 450);
	const [x2, y2] = place(iconGradient.x2, 450);
	const at = (value, offset) => round(value * scale + offset);

	return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${at(x1, offsetX)}" y1="${at(y1, offsetY)}" x2="${at(x2, offsetX)}" y2="${at(y2, offsetY)}"><stop offset="0" stop-color="${iconGradient.from}"/><stop offset="1" stop-color="${iconGradient.to}"/></linearGradient>`;
}

function iconShape(fill, { x = 0, y = 0, scale = 1, id = 'solvebeam-gradient' } = {}) {
	if (fill === 'gradient') {
		return `<defs>${gradientDefinition(id, x, y, scale)}</defs><path fill="url(#${id})" d="${buildIconPath(x, y, scale)}"/>`;
	}

	return `<path fill="${fill}" d="${buildIconPath(x, y, scale)}"/>`;
}

/* Wordmark: Roboto Bold converted to outlines, so it never depends on an installed font. */

function loadFont(weight) {
	const file = require.resolve(`@fontsource/roboto/files/roboto-latin-${weight}-normal.woff`);
	const bytes = readFileSync(file);

	return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

const bold = loadFont(700);
const regular = loadFont(400);
const WORDMARK_SIZE = 400;
const WORDMARK_CENTER = 1781.68; // From the Inkscape master, relative to the icon's left edge.
const WORDMARK_BASELINE = 424.857; // Relative to the top of the icon shape.

/**
 * Lays out text glyph by glyph with the font's pair kerning. The Latin text used here needs no
 * other OpenType features, and opentype.js cannot process all of Roboto's substitution tables.
 */
function layoutText(font, text, size) {
	const scale = size / font.unitsPerEm;
	const tables = font.position.defaultKerningTables;
	const glyphs = [...text].map((character) => font.charToGlyph(character));
	let advance = 0;

	const placed = glyphs.map((glyph, index) => {
		const previous = glyphs[index - 1];

		if (previous) {
			advance += (tables ? font.position.getKerningValue(tables, previous.index, glyph.index) : font.getKerningValue(previous, glyph)) * scale;
		}

		const position = { glyph, x: advance };

		advance += glyph.advanceWidth * scale;

		return position;
	});

	return { placed, width: advance };
}

function textWidth(font, text, size) {
	return layoutText(font, text, size).width;
}

function textPath(font, text, x, y, size) {
	const path = new opentype.Path();

	for (const { glyph, x: offset } of layoutText(font, text, size).placed) {
		path.extend(glyph.getPath(x + offset, y, size));
	}

	return path;
}

const wordmarkWidth = textWidth(bold, 'SolveBeam', WORDMARK_SIZE);
const wordmarkStart = WORDMARK_CENTER - wordmarkWidth / 2;
const wordmarkBox = textPath(bold, 'SolveBeam', 0, 0, WORDMARK_SIZE).getBoundingBox();

function wordmarkShape(fill, x, baseline, size = WORDMARK_SIZE) {
	return `<path fill="${fill}" d="${textPath(bold, 'SolveBeam', x, baseline, size).toPathData(3)}"/>`;
}

/* SVG output. */

function svgDocument(width, height, body) {
	const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="SolveBeam"><title>SolveBeam</title>${body}</svg>`;

	return optimize(source, {
		multipass: true,
		floatPrecision: 3,
		plugins: [{
			name: 'preset-default',
			params: { overrides: { mergePaths: false, cleanupIds: false } },
		}],
	}).data;
}

const written = [];

function write(path, data) {
	const target = join(root, path);

	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, data);
	written.push(path);
}

/** Renders an SVG at an exact width and height, by rewriting its root dimensions. */
function raster(svg, width, height) {
	const sized = svg.replace(/<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${width}" height="${height}"`);

	return sharp(Buffer.from(sized)).resize(width, height, { fit: 'fill' });
}

async function png(path, svg, width, height) {
	const data = await raster(svg, width, height).png({ compressionLevel: 9, effort: 10 }).toBuffer();

	write(path, data);

	return data;
}

/* Variant definitions. */

const iconVariants = { gradient: 'gradient', orange, ink, black, white };

const logoVariants = {
	'on-light': ['gradient', ink],
	'on-dark': ['gradient', white],
	orange: [orange, ink],
	ink: [ink, ink],
	black: [black, black],
	white: [white, white],
};

const wordmarkVariants = { ink, orange, black, white };

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const LOGO_WIDTHS = [256, 512, 1024, 2048];

const iconSvg = (fill) => svgDocument(ICON_SIZE, ICON_SIZE, iconShape(fill, {}));

const LOGO_WIDTH = wordmarkStart + wordmarkBox.x2;

function horizontalSvg([iconFill, textFill]) {
	return svgDocument(LOGO_WIDTH, ICON_HEIGHT, iconShape(iconFill, { y: -ICON_TOP }) + wordmarkShape(textFill, wordmarkStart, WORDMARK_BASELINE));
}

const STACKED_WORD_WIDTH = 1400;
const STACKED_GAP = 141.421; // The diameter of one dot of the icon.
const stackedSize = WORDMARK_SIZE * (STACKED_WORD_WIDTH / (wordmarkBox.x2 - wordmarkBox.x1));
const stackedScale = stackedSize / WORDMARK_SIZE;
const stackedBaseline = ICON_HEIGHT + STACKED_GAP - wordmarkBox.y1 * stackedScale;
const stackedHeight = stackedBaseline + wordmarkBox.y2 * stackedScale;

function stackedSvg([iconFill, textFill]) {
	const iconX = (STACKED_WORD_WIDTH - ICON_SIZE) / 2;
	const textX = -wordmarkBox.x1 * stackedScale;

	return svgDocument(
		STACKED_WORD_WIDTH,
		stackedHeight,
		iconShape(iconFill, { x: iconX, y: -ICON_TOP }) + wordmarkShape(textFill, textX, stackedBaseline, stackedSize),
	);
}

const wordWidth = wordmarkBox.x2 - wordmarkBox.x1;
const wordHeight = wordmarkBox.y2 - wordmarkBox.y1;

const wordmarkSvg = (fill) => svgDocument(wordWidth, wordHeight, wordmarkShape(fill, -wordmarkBox.x1, -wordmarkBox.y1));

const ratioHeight = (svgWidth, svgHeight, width) => Math.round((width * svgHeight) / svgWidth);

/** A full-bleed canvas with the icon centred; `share` is the icon's part of the canvas width. */
function tileSvg(size, background, fill, share) {
	const scale = (size * share) / ICON_SIZE;
	const offset = (size - ICON_SIZE * scale) / 2;

	return svgDocument(size, size, `<rect width="${size}" height="${size}" fill="${background}"/>${iconShape(fill, { x: offset, y: offset, scale })}`);
}

/** A dark social card: logo in the centre, motto below it, gradient bar along the bottom. */
function cardSvg(width, height, withMotto = true) {
	const logoWidth = Math.min(width * 0.62, 860);
	const scale = logoWidth / LOGO_WIDTH;
	const logoHeight = ICON_HEIGHT * scale;
	const motto = "Let's build something great, one solution at a time.";
	const mottoSize = logoWidth * 0.0405;
	const block = withMotto ? logoHeight + mottoSize * 2.6 : logoHeight;
	const left = (width - logoWidth) / 2;
	const top = (height - block) / 2;
	const bar = Math.round(height * 0.016);
	const baseline = top + (WORDMARK_BASELINE * scale);
	const mottoWidth = textWidth(regular, motto, mottoSize);
	const mottoPath = withMotto
		? `<path fill="${color('ash').hex}" d="${textPath(regular, motto, (width - mottoWidth) / 2, top + logoHeight + mottoSize * 2.3, mottoSize).toPathData(3)}"/>`
		: '';

	return svgDocument(width, height, [
		`<defs><linearGradient id="solvebeam-bar"><stop offset="0" stop-color="${gradient.from}"/><stop offset="1" stop-color="${gradient.to}"/></linearGradient></defs>`,
		`<rect width="${width}" height="${height}" fill="${ink}"/>`,
		`<rect y="${height - bar}" width="${width}" height="${bar}" fill="url(#solvebeam-bar)"/>`,
		iconShape('gradient', { x: left, y: top - ICON_TOP * scale, scale }),
		wordmarkShape(white, left + wordmarkStart * scale, baseline, WORDMARK_SIZE * scale),
		mottoPath,
	].join(''));
}

/** Combines PNG images in one ICO file; every modern browser reads PNG entries. */
function ico(images) {
	const header = Buffer.alloc(6 + 16 * images.length);
	let offset = header.length;

	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	images.forEach(({ size, data }, index) => {
		const entry = 6 + 16 * index;

		header.writeUInt8(size, entry);
		header.writeUInt8(size, entry + 1);
		header.writeUInt16LE(1, entry + 4);
		header.writeUInt16LE(32, entry + 6);
		header.writeUInt32LE(data.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);
		offset += data.length;
	});

	return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

function writeTokens() {
	const json = {
		colors: Object.fromEntries(colors.map(({ id, name, hex, group, role, pantone }) => {
			const rgb = hexToRgb(hex);

			return [id, { name, hex, rgb, hsl: rgbToHsl(rgb), group, role, ...(pantone ? { pantone } : {}) }];
		})),
		gradient,
		typography,
	};

	write('tokens/tokens.json', `${JSON.stringify(json, null, '\t')}\n`);

	const lines = [
		'/* SolveBeam design tokens. Generated by scripts/build-assets.mjs, do not edit. */',
		':root {',
		...colors.map(({ id, hex }) => `\t--sb-color-${id}: ${hex};`),
		`\t--sb-gradient: ${gradient.css};`,
		`\t--sb-font: ${typography.stack};`,
		`\t--sb-font-mono: ${typography.mono};`,
		...Object.entries(typography.weights).map(([name, value]) => `\t--sb-weight-${name}: ${value};`),
		...typography.scale.flatMap(({ id, size, lineHeight, weight, tracking }) => [
			`\t--sb-text-${id}-size: ${size};`,
			`\t--sb-text-${id}-line-height: ${lineHeight};`,
			`\t--sb-text-${id}-weight: ${weight};`,
			`\t--sb-text-${id}-tracking: ${tracking};`,
		]),
		'}',
		'',
	];

	write('tokens/tokens.css', lines.join('\n'));
}

/* Build. */

rmSync(join(root, 'assets'), { recursive: true, force: true });
writeTokens();

for (const [name, fill] of Object.entries(iconVariants)) {
	const svg = iconSvg(fill);

	write(`assets/icon/svg/solvebeam-icon-${name}.svg`, svg);

	for (const size of ICON_SIZES) {
		await png(`assets/icon/png/solvebeam-icon-${name}-${size}.png`, svg, size, size);
	}
}

for (const [layout, build, height, width] of [
	['horizontal', horizontalSvg, ICON_HEIGHT, LOGO_WIDTH],
	['stacked', stackedSvg, stackedHeight, STACKED_WORD_WIDTH],
]) {
	for (const [name, fills] of Object.entries(logoVariants)) {
		const svg = build(fills);

		write(`assets/logo/${layout}/svg/solvebeam-logo-${layout}-${name}.svg`, svg);

		for (const target of LOGO_WIDTHS) {
			await png(`assets/logo/${layout}/png/solvebeam-logo-${layout}-${name}-${target}w.png`, svg, target, ratioHeight(width, height, target));
		}
	}
}

for (const [name, fill] of Object.entries(wordmarkVariants)) {
	const svg = wordmarkSvg(fill);

	write(`assets/wordmark/svg/solvebeam-wordmark-${name}.svg`, svg);

	for (const target of LOGO_WIDTHS) {
		await png(`assets/wordmark/png/solvebeam-wordmark-${name}-${target}w.png`, svg, target, ratioHeight(wordWidth, wordHeight, target));
	}
}

/* Favicons and app icons. */

const faviconSvg = iconSvg('gradient');
const icoImages = [];

write('assets/favicon/favicon.svg', faviconSvg);

for (const size of [16, 32, 48]) {
	icoImages.push({ size, data: await png(`assets/favicon/favicon-${size}.png`, faviconSvg, size, size) });
}

write('assets/favicon/favicon.ico', ico(icoImages));
await png('assets/favicon/icon-192.png', faviconSvg, 192, 192);
await png('assets/favicon/icon-512.png', faviconSvg, 512, 512);
await png('assets/favicon/apple-touch-icon.png', tileSvg(180, white, 'gradient', 0.76), 180, 180);
await png('assets/favicon/icon-maskable-512.png', tileSvg(512, white, 'gradient', 0.62), 512, 512);

write('assets/favicon/site.webmanifest', `${JSON.stringify({
	name: 'SolveBeam Brand',
	short_name: 'SolveBeam',
	icons: [
		{ src: '/assets/favicon/icon-192.png', sizes: '192x192', type: 'image/png' },
		{ src: '/assets/favicon/icon-512.png', sizes: '512x512', type: 'image/png' },
		{ src: '/assets/favicon/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
	],
	theme_color: orange,
	background_color: white,
	display: 'standalone',
}, null, '\t')}\n`);

/* Social images. */

for (const [name, background, fill] of [['light', white, 'gradient'], ['dark', ink, 'gradient'], ['orange', orange, white]]) {
	for (const size of [400, 800]) {
		const svg = tileSvg(size, background, fill, 0.66);

		await png(`assets/social/solvebeam-avatar-${name}-${size}.png`, svg, size, size);
	}

	write(`assets/social/solvebeam-avatar-${name}.svg`, tileSvg(800, background, fill, 0.66));
}

for (const [name, width, height, motto] of [
	['open-graph', 1200, 630, true],
	['github-social-preview', 1280, 640, true],
	['x-banner', 1500, 500, false],
]) {
	await png(`assets/social/solvebeam-${name}-${width}x${height}.png`, cardSvg(width, height, motto), width, height);
}

/* Fixed sizes that external services ask for. */

const onLight = horizontalSvg(logoVariants['on-light']);

for (const [path, width, height] of [
	['moneybird-640x128', 640, 128],
	['moneybird-1280x256', 1280, 256],
]) {
	const logoHeight = ratioHeight(LOGO_WIDTH, ICON_HEIGHT, width);
	const logo = await raster(onLight, width, logoHeight).png().toBuffer();
	const top = Math.floor((height - logoHeight) / 2);
	const data = await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
		.composite([{ input: logo, left: 0, top }])
		.png({ compressionLevel: 9, effort: 10 })
		.toBuffer();

	write(`assets/integrations/solvebeam-${path}.png`, data);
}

{
	const width = 320;
	const height = 132;
	const logoWidth = 300;
	const logoHeight = ratioHeight(LOGO_WIDTH, ICON_HEIGHT, logoWidth);
	const logo = await raster(onLight, logoWidth, logoHeight).png().toBuffer();
	const data = await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
		.composite([{ input: logo, left: (width - logoWidth) / 2, top: Math.floor((height - logoHeight) / 2) }])
		.png({ compressionLevel: 9, effort: 10 })
		.toBuffer();

	write('assets/integrations/solvebeam-google-workspace-320x132.png', data);
}

/* Roboto, with its licence. */

mkdirSync(join(root, 'assets/fonts'), { recursive: true });

for (const weight of Object.values(typography.weights)) {
	const target = `assets/fonts/roboto-latin-${weight}-normal.woff2`;

	copyFileSync(require.resolve(`@fontsource/roboto/files/roboto-latin-${weight}-normal.woff2`), join(root, target));
	written.push(target);
}

copyFileSync(join(dirname(require.resolve('@fontsource/roboto/files/roboto-latin-400-normal.woff2')), '..', 'LICENSE'), join(root, 'assets/fonts/LICENSE-Roboto.txt'));
written.push('assets/fonts/LICENSE-Roboto.txt');

console.log(`Wrote ${written.length} files.`);
