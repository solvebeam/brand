import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

export const LOGO_WIDTHS = [256, 512, 1024, 2048];
export const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

export const toneFor = (variant) => (/white|on-dark/.test(variant) ? 'dark' : 'light');

export function iconAsset(variant) {
	return {
		preview: `/assets/icon/svg/solvebeam-icon-${variant}.svg`,
		tone: toneFor(variant),
		links: [
			{ label: 'SVG', href: `/assets/icon/svg/solvebeam-icon-${variant}.svg` },
			...ICON_SIZES.map((size) => ({ label: String(size), href: `/assets/icon/png/solvebeam-icon-${variant}-${size}.png` })),
		],
	};
}

export function logoAsset(layout, variant) {
	const base = `/assets/logo/${layout}`;

	return {
		preview: `${base}/svg/solvebeam-logo-${layout}-${variant}.svg`,
		tone: toneFor(variant),
		links: [
			{ label: 'SVG', href: `${base}/svg/solvebeam-logo-${layout}-${variant}.svg` },
			...LOGO_WIDTHS.map((width) => ({ label: `${width}w`, href: `${base}/png/solvebeam-logo-${layout}-${variant}-${width}w.png` })),
		],
	};
}

export function wordmarkAsset(variant) {
	return {
		preview: `/assets/wordmark/svg/solvebeam-wordmark-${variant}.svg`,
		tone: toneFor(variant),
		links: [
			{ label: 'SVG', href: `/assets/wordmark/svg/solvebeam-wordmark-${variant}.svg` },
			...LOGO_WIDTHS.map((width) => ({ label: `${width}w`, href: `/assets/wordmark/png/solvebeam-wordmark-${variant}-${width}w.png` })),
		],
	};
}

export const iconVariants = [
	['gradient', 'Gradient'],
	['orange', 'Beam Orange'],
	['ink', 'Ink'],
	['black', 'Black'],
	['white', 'White'],
];

export const logoVariants = [
	['on-light', 'On light'],
	['on-dark', 'On dark'],
	['orange', 'Beam Orange'],
	['ink', 'Ink'],
	['black', 'Black'],
	['white', 'White'],
];

export const wordmarkVariants = [
	['ink', 'Ink'],
	['orange', 'Beam Orange'],
	['black', 'Black'],
	['white', 'White'],
];

function formatSize(bytes) {
	return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

/** Every file of one folder in assets/, for the plain download lists. */
export function listFolder(folder) {
	return readdirSync(join(root, 'assets', folder))
		.filter((name) => !name.startsWith('.'))
		.sort()
		.map((name) => ({
			name,
			href: `/assets/${folder}/${name}`,
			size: formatSize(statSync(join(root, 'assets', folder, name)).size),
			isImage: /\.(png|svg)$/.test(name),
		}));
}
