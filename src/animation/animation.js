import { stagger, svg } from 'animejs';
import {
	CELL,
	COLS,
	GAP,
	HEAD,
	INNER,
	R,
	SIZE,
	bottomRight,
	gradient as gradientColors,
	iconPath,
	innerEdges,
	neckEdges,
	outerEdges,
	topLeft,
} from '../brand/geometry.js';
import { createPlayer } from './player.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(parent, tag, attributes = {}, text = '') {
	const node = document.createElementNS(SVG_NS, tag);

	for (const [key, value] of Object.entries(attributes)) {
		node.setAttribute(key, value);
	}

	node.textContent = text;
	parent.append(node);

	return node;
}

/** Hulplijn die zich laat "tekenen"; begint onzichtbaar. */
function outline(parent, [x1, y1], [x2, y2]) {
	const node = el(parent, 'line', { class: 'outline', x1, y1, x2, y2, opacity: 0 });

	return svg.createDrawable(node, 0, 0)[0];
}

/**
 * Hulpcirkel die zich laat "tekenen"; begint onzichtbaar.
 * `startAngle` (graden, 0 = rechts, 180 = links) bepaalt waar het tekenen begint.
 */
function outlineCircle(parent, [cx, cy], r, startAngle = 0) {
	const node = el(parent, 'circle', {
		class: 'outline',
		cx,
		cy,
		r,
		opacity: 0,
		transform: `rotate(${startAngle} ${cx} ${cy})`,
	});

	return svg.createDrawable(node, 0, 0)[0];
}

const layers = {
	rows: document.querySelector('#grid-rows'),
	cols: document.querySelector('#grid-cols'),
	labels: document.querySelector('#labels'),
	construction: document.querySelector('#construction'),
};

/* Raster. */

// Hulplijnen lopen iets door buiten het raster, zoals op een bouwtekening.
const OVERSHOOT = 15;

const rowLines = [];
const colLines = [];
const colLabels = [];
const rowLabels = [];

for (let i = 0; i < COLS.length; i++) {
	colLabels.push(el(layers.labels, 'text', { class: 'label', x: i * CELL + CELL / 2, y: -40, opacity: 0 }, COLS[i]));
	rowLabels.push(el(layers.labels, 'text', { class: 'label', x: -40, y: i * CELL + CELL / 2, opacity: 0 }, i + 1));
}

for (let i = 0; i <= COLS.length; i++) {
	const at = i * CELL;
	const from = -OVERSHOOT;
	const to = SIZE + OVERSHOOT;

	const row = el(layers.rows, 'line', { class: 'grid-line', x1: from, y1: at, x2: to, y2: at, opacity: 0 });
	const col = el(layers.cols, 'line', { class: 'grid-line', x1: at, y1: from, x2: at, y2: to, opacity: 0 });

	rowLines.push(svg.createDrawable(row, 0, 0)[0]);
	colLines.push(svg.createDrawable(col, 0, 0)[0]);
}

/* Vierkante ring: buitenrand B2–H8, binnenrand één cel naar binnen. */

const outer = outerEdges.map(([from, to]) => outline(layers.construction, from, to));
const inner = innerEdges.map(([from, to]) => outline(layers.construction, from, to));

/*
 * Cirkels van de twee bogen, rond het midden van D4 (linksboven) en F6 (rechtsonder).
 * Het tekenen begint steeds op het raakpunt met de ring: links bij B4/C4, rechts bij H6/G6.
 */

const outerCircles = [
	outlineCircle(layers.construction, topLeft, R, 180),
	outlineCircle(layers.construction, bottomRight, R, 0),
];

const innerCircles = [
	outlineCircle(layers.construction, topLeft, INNER, 180),
	outlineCircle(layers.construction, bottomRight, INNER, 0),
];

/* Bolletjes: de uiteinden van de S. */

const headCircles = [
	outlineCircle(layers.construction, topLeft, HEAD, 180),
	outlineCircle(layers.construction, bottomRight, HEAD, 0),
];

/* Verbindingslijnen tussen de cirkels en de bolletjes. */

const neckLines = neckEdges.map(([from, to]) => outline(layers.construction, from, to));

/* Ruimtecirkels: de witruimte tussen de S en de twee pijlpunten. */

const gapCircles = [
	outlineCircle(layers.construction, topLeft, GAP, 180),
	outlineCircle(layers.construction, bottomRight, GAP, 0),
];

/* De eindvorm van het icoon, nog ongedraaid. */

const iconFill = el(document.querySelector('#icon-fill'), 'path', { class: 'shape', d: iconPath, opacity: 0 });
const iconOutline = el(document.querySelector('#icon-outline'), 'path', { class: 'outline', d: iconPath, opacity: 0 });

/* Kleurverloop; draait met het icoon mee. */

const defs = el(document.querySelector('#stage'), 'defs');

const gradient = el(defs, 'linearGradient', {
	id: 'icon-gradient',
	gradientUnits: 'userSpaceOnUse',
	x1: gradientColors.x1,
	y1: 0,
	x2: gradientColors.x2,
	y2: 0,
});

el(gradient, 'stop', { offset: 0, 'stop-color': gradientColors.from });
el(gradient, 'stop', { offset: 1, 'stop-color': gradientColors.to });

const iconGradientFill = el(document.querySelector('#icon-fill'), 'path', {
	d: iconPath,
	fill: 'url(#icon-gradient)',
	opacity: 0,
});

/* Tijdlijn. */

/** Rasterlijnen kort na elkaar tekenen. */
const drawGrid = {
	opacity: { to: 1, duration: 1 },
	draw: '0 1',
	duration: 500,
	delay: stagger(50),
	ease: 'outCubic',
};

/** Lijnen één voor één tekenen, elk `duration` ms. */
function drawInOrder(duration) {
	return {
		opacity: { to: 1, duration: 1 },
		draw: '0 1',
		duration,
		delay: stagger(duration),
		ease: 'inOutSine',
	};
}

/**
 * Elke stap voegt zijn animaties achteraan de tijdlijn toe.
 * Nieuwe stappen (cirkels, uitsnijden, draaien) komen hier onderaan bij.
 */
const steps = [
	{
		name: 'Grid: nine rows',
		build: (tl) => tl.add(rowLines, drawGrid),
	},
	{
		name: 'Grid: nine columns',
		build: (tl) => tl.add(colLines, drawGrid),
	},
	{
		name: 'Columns A–I and rows 1–9',
		build: (tl) => tl
			.add(colLabels, { opacity: 1, duration: 300, delay: stagger(50), ease: 'linear' })
			.add(rowLabels, { opacity: 1, duration: 300, delay: stagger(50), ease: 'linear' }, '<-=350'),
	},
	{
		name: 'Outer edge: B2 → H2 → H8 → B8 → B2',
		build: (tl) => tl.add(outer, drawInOrder(450)),
	},
	{
		name: 'Inner edge: one cell inwards',
		build: (tl) => tl.add(inner, drawInOrder(350)),
	},
	{
		name: 'Outer circles: top left from B4, bottom right from H6',
		build: (tl) => tl.add(outerCircles, drawInOrder(1100)),
	},
	{
		name: 'Inner circles: top left from C4, bottom right from G6',
		build: (tl) => tl.add(innerCircles, drawInOrder(800)),
	},
	{
		name: 'Dots: one cell around the centres of D4 and F6',
		build: (tl) => tl.add(headCircles, drawInOrder(600)),
	},
	{
		name: 'Connecting lines: mid D to mid F, in rows 4 and 6',
		build: (tl) => tl.add(neckLines, drawInOrder(400)),
	},
	{
		name: 'Clearance circles: half a cell outside the outer circles',
		build: (tl) => tl.add(gapCircles, drawInOrder(1100)),
	},
	{
		name: 'Fill: only the areas that form the icon',
		build: (tl) => tl.add(iconFill, { opacity: 0.3, duration: 900, ease: 'inOutSine' }),
	},
	{
		name: 'Remove every guide that is not part of the icon',
		build: (tl) => tl
			// De eindvorm ligt precies op de hulplijnen; daarna vervaagt alles eromheen.
			.add(iconOutline, { opacity: 1, duration: 1 })
			.add(layers.construction, { opacity: 0, duration: 1000, ease: 'inOutSine' }),
	},
	{
		name: 'Rotate the icon 45° clockwise',
		// Gedraaid is het icoon √2 keer zo breed; verkleinen met 1/√2 houdt het binnen B t/m H.
		build: (tl) => tl.add('#icon', { rotate: 45, scale: Math.SQRT1_2, duration: 1600, ease: 'inOutCubic' }),
	},
	{
		name: 'Drop the outline, apply the gradient from #ff0000 to #fab816',
		build: (tl) => tl
			.add(iconGradientFill, { opacity: 1, duration: 1200, ease: 'inOutSine' })
			.add('#icon-outline', { opacity: 0, duration: 1200, ease: 'inOutSine' }, '<<'),
	},
];

createPlayer(steps);
