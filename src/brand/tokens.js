/**
 * SolveBeam design tokens: the single source for colours and typography.
 * `npm run build:assets` writes these to tokens/tokens.json and tokens/tokens.css.
 */

export const colors = [
	{ id: 'orange', name: 'Beam Orange', hex: '#fa4616', group: 'brand', pantone: 'Pantone 172 C', role: 'Primary colour for surfaces, buttons, accents and large text.' },
	{ id: 'red', name: 'Beam Red', hex: '#ff0000', group: 'brand', role: 'Gradient start. Not used as a solid colour.' },
	{ id: 'nacho', name: 'Master Nacho', hex: '#fab816', group: 'brand', role: 'Gradient end and warm highlight.' },
	{ id: 'orange-deep', name: 'Orange Deep', hex: '#c8360c', group: 'support', role: 'Links and small orange text on light backgrounds.' },
	{ id: 'orange-light', name: 'Orange Light', hex: '#ff7a4d', group: 'support', role: 'Links and small orange text on dark backgrounds.' },
	{ id: 'ink', name: 'Ink', hex: '#1a1a1a', group: 'neutral', role: 'Text, wordmark and dark backgrounds.' },
	{ id: 'coal', name: 'Coal', hex: '#262626', group: 'neutral', role: 'Raised surfaces on dark backgrounds.' },
	{ id: 'slate', name: 'Slate', hex: '#5f5f5c', group: 'neutral', role: 'Secondary text on light backgrounds.' },
	{ id: 'ash', name: 'Ash', hex: '#a8a8a3', group: 'neutral', role: 'Secondary text on dark backgrounds.' },
	{ id: 'stone', name: 'Stone', hex: '#dcdbd6', group: 'neutral', role: 'Borders and dividers on light backgrounds.' },
	{ id: 'paper', name: 'Paper', hex: '#f7f6f3', group: 'neutral', role: 'Page background.' },
	{ id: 'white', name: 'White', hex: '#ffffff', group: 'neutral', role: 'Surfaces and reversed logos.' },
];

export const gradient = {
	name: 'Beam Gradient',
	from: '#ff0000',
	to: '#fab816',
	angle: 135,
	css: 'linear-gradient(135deg, #ff0000, #fab816)',
};

export const typography = {
	family: 'Roboto',
	stack: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif",
	mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
	weights: { regular: 400, medium: 500, bold: 700 },
	scale: [
		{ id: 'display', label: 'Display', size: '4rem', lineHeight: 1.05, weight: 700, tracking: '-0.02em' },
		{ id: 'h1', label: 'Heading 1', size: '2.75rem', lineHeight: 1.1, weight: 700, tracking: '-0.015em' },
		{ id: 'h2', label: 'Heading 2', size: '1.875rem', lineHeight: 1.2, weight: 700, tracking: '-0.01em' },
		{ id: 'h3', label: 'Heading 3', size: '1.25rem', lineHeight: 1.3, weight: 500, tracking: '0' },
		{ id: 'body', label: 'Body', size: '1rem', lineHeight: 1.6, weight: 400, tracking: '0' },
		{ id: 'small', label: 'Small', size: '0.875rem', lineHeight: 1.5, weight: 400, tracking: '0' },
	],
};

/** Colour pairs the brand relies on, with the WCAG contrast each one has to reach. */
export const contrastPairs = [
	{ text: 'ink', background: 'paper', minimum: 4.5 },
	{ text: 'ink', background: 'white', minimum: 4.5 },
	{ text: 'ink', background: 'orange', minimum: 4.5 },
	{ text: 'ink', background: 'nacho', minimum: 4.5 },
	{ text: 'slate', background: 'paper', minimum: 4.5 },
	{ text: 'slate', background: 'white', minimum: 4.5 },
	{ text: 'orange-deep', background: 'paper', minimum: 4.5 },
	{ text: 'orange-deep', background: 'white', minimum: 4.5 },
	{ text: 'white', background: 'ink', minimum: 4.5 },
	{ text: 'paper', background: 'ink', minimum: 4.5 },
	{ text: 'ash', background: 'ink', minimum: 4.5 },
	{ text: 'ash', background: 'coal', minimum: 4.5 },
	{ text: 'orange-light', background: 'ink', minimum: 4.5 },
	{ text: 'orange-light', background: 'coal', minimum: 4.5 },
	{ text: 'orange', background: 'white', minimum: 3 },
	{ text: 'white', background: 'orange', minimum: 3 },
];

export function hexToRgb(hex) {
	const value = Number.parseInt(hex.slice(1), 16);

	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHsl([r, g, b]) {
	const [red, green, blue] = [r / 255, g / 255, b / 255];
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const delta = max - min;
	const lightness = (max + min) / 2;
	let hue = 0;
	let saturation = 0;

	if (delta > 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));

		if (max === red) {
			hue = ((green - blue) / delta + 6) % 6;
		} else if (max === green) {
			hue = (blue - red) / delta + 2;
		} else {
			hue = (red - green) / delta + 4;
		}
	}

	return [Math.round(hue * 60), Math.round(saturation * 100), Math.round(lightness * 100)];
}

function luminance(hex) {
	const [r, g, b] = hexToRgb(hex).map((channel) => {
		const value = channel / 255;

		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(first, second) {
	const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);

	return (light + 0.05) / (dark + 0.05);
}

export function color(id) {
	return colors.find((item) => item.id === id);
}
