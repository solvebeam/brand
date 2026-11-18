/** Checks the generated files. Exits with an error when something is wrong. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { color, contrast, contrastPairs } from '../src/brand/tokens.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function filesIn(directory) {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);

		return statSync(path).isDirectory() ? filesIn(path) : [path];
	});
}

const files = filesIn(join(root, 'assets'));

for (const file of files) {
	const name = relative(root, file);

	if (file.endsWith('.svg')) {
		const svg = readFileSync(file, 'utf8');

		if (/<text|<image|\stransform=|font-family/.test(svg)) {
			problems.push(`${name}: contains text, an image or a transform`);
		}

		if (!/viewBox="/.test(svg)) {
			problems.push(`${name}: has no viewBox`);
		}
	}

	if (file.endsWith('.png')) {
		const { width, height, hasAlpha } = await sharp(file).metadata();
		const base = basename(file, '.png');
		const box = base.match(/-(\d+)x(\d+)$/);
		const logoWidth = base.match(/-(\d+)w$/);
		const square = base.match(/-(\d+)$/);

		if (box && (width !== Number(box[1]) || height !== Number(box[2]))) {
			problems.push(`${name}: is ${width}×${height}`);
		} else if (logoWidth && width !== Number(logoWidth[1])) {
			problems.push(`${name}: is ${width} wide`);
		} else if (!box && !logoWidth && square && (width !== Number(square[1]) || height !== Number(square[1]))) {
			problems.push(`${name}: is ${width}×${height}`);
		}

		if (/assets\/(icon|logo|wordmark|integrations)\//.test(name)) {
			const { isOpaque } = await sharp(file).stats();

			if (!hasAlpha || isOpaque) {
				problems.push(`${name}: is not transparent`);
			}
		}
	}
}

const ico = readFileSync(join(root, 'assets/favicon/favicon.ico'));
const icoSizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico[6 + 16 * index]);

if (icoSizes.join() !== '16,32,48') {
	problems.push(`favicon.ico: contains sizes ${icoSizes.join()}`);
}

for (const { text, background, minimum } of contrastPairs) {
	const ratio = contrast(color(text).hex, color(background).hex);

	if (ratio < minimum) {
		problems.push(`${text} on ${background}: contrast ${ratio.toFixed(2)} is below ${minimum}`);
	}
}

if (problems.length > 0) {
	console.error(problems.join('\n'));
	process.exit(1);
}

console.log(`Checked ${files.length} files and ${contrastPairs.length} colour pairs.`);
