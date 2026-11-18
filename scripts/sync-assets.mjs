/**
 * Copies assets/ and tokens/ into public/ so the site serves them at stable URLs,
 * and packs them into one zip file.
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inRoot = (...parts) => join(root, ...parts);

for (const directory of ['assets', 'tokens']) {
	rmSync(inRoot('public', directory), { recursive: true, force: true });
	cpSync(inRoot(directory), inRoot('public', directory), { recursive: true });
}

for (const file of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) {
	cpSync(inRoot('assets/favicon', file), inRoot('public', file));
}

function filesIn(directory) {
	return readdirSync(directory).sort().flatMap((name) => {
		const path = join(directory, name);

		return statSync(path).isDirectory() ? filesIn(path) : [path];
	});
}

const entries = {};

for (const file of [...filesIn(inRoot('assets')), ...filesIn(inRoot('tokens'))]) {
	entries[`solvebeam-brand/${relative(root, file)}`] = [readFileSync(file), { mtime: new Date('2026-01-01T00:00:00Z') }];
}

mkdirSync(inRoot('public/downloads'), { recursive: true });
writeFileSync(inRoot('public/downloads/solvebeam-brand-assets.zip'), zipSync(entries, { level: 9 }));

console.log(`Synced ${Object.keys(entries).length} files to public/.`);
