import { svg } from 'animejs';
import rough from 'roughjs';
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

/*
 * Schetsvariant: dezelfde constructie als `animation.js`, maar met de hand getekend.
 * Rough.js maakt van elke lijn, cirkel en arcering een wiebelig pad; anime.js tekent die
 * paden streek voor streek, en een potlood (of krijtje, in het donkere thema) volgt de punt.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const stage = document.querySelector('#stage');

const layers = {
	rows: document.querySelector('#grid-rows'),
	cols: document.querySelector('#grid-cols'),
	labels: document.querySelector('#labels'),
	shape: document.querySelector('#shape'),
	construction: document.querySelector('#construction'),
	iconFill: document.querySelector('#icon-fill'),
	iconOutline: document.querySelector('#icon-outline'),
};

/*
 * Elke schets is anders, maar dezelfde `seed` geeft steeds dezelfde schets. Dat houdt slepen
 * door de tijdlijn en `#t=` voorspelbaar. `#seed=7` kiest een andere hand.
 */

const baseSeed = Number(new URLSearchParams(location.hash.slice(1)).get('seed')) || 1;

let shapeCount = 0;

/** Elke vorm zijn eigen seed, anders wiebelen evenwijdige lijnen precies gelijk. */
function nextSeed() {
	shapeCount += 1;

	return baseSeed * 1000 + shapeCount;
}

/** Kleine willekeurige afwijking tussen -1 en 1, vast per seed (mulberry32). */
let randomState = baseSeed;

function jitter() {
	randomState = (randomState + 0x6d2b79f5) | 0;

	let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);

	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

	return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

const rc = rough.svg(stage);

/* Hoe ruw elke soort lijn is. De kleuren en lijndiktes staan in `style.css`. */

const GRID = { roughness: 0.5, bowing: 0.8, disableMultiStroke: true };
const LINE = { roughness: 1, bowing: 1.2 };
const CIRCLE = { roughness: 0.8, curveStepCount: 12 };
const TRACE = { roughness: 0.55, bowing: 0.5, preserveVertices: true };

const HATCH = {
	stroke: 'none',
	fill: '#000',
	fillStyle: 'hachure',
	hachureAngle: -45,
	hachureGap: 17,
	roughness: 1.3,
	disableMultiStrokeFill: true,
};

// Het icoon draait later 45° met de klok mee; op het scherm loopt deze arcering dan onder 65°.
const CRAYON = {
	stroke: 'none',
	fill: 'url(#icon-gradient)',
	fillStyle: 'hachure',
	hachureAngle: 20,
	hachureGap: 10.5,
	roughness: 1.6,
	disableMultiStrokeFill: true,
};

/** Alle streken in tekenvolgorde, zodat het potlood de streek kan vinden die nu getekend wordt. */
const tracked = [];

/**
 * Zet een Rough.js-vorm in een laag en knipt hem op in losse streken.
 *
 * Rough.js levert per vorm één `<path>` met meerdere subpaden (de dubbele streek van een lijn,
 * alle lijnen van een arcering). Een streepjespatroon begint bij elk subpad opnieuw, dus
 * als één pad zouden al die streken tegelijk verschijnen in plaats van na elkaar.
 *
 * `direction` bepaalt per streek of hij van begin naar eind (`false`) of andersom (`true`)
 * getekend wordt.
 */
function sketch(parent, node, direction = () => false) {
	const strokes = [];

	parent.append(node);

	for (const path of [...node.querySelectorAll('path')]) {
		for (const d of path.getAttribute('d').split(/(?=M)/)) {
			const piece = path.cloneNode();

			piece.setAttribute('d', d);
			piece.setAttribute('opacity', 0);
			path.before(piece);

			const reversed = direction(strokes.length);

			strokes.push({
				node: piece,
				reversed,
				length: piece.getTotalLength(),
				drawable: svg.createDrawable(piece, reversed ? 1 : 0, reversed ? 1 : 0)[0],
			});
		}

		path.remove();
	}

	return strokes;
}

const back = (i) => i % 2 === 1;

/** Lijn in twee streken: heen en weer terug, zoals je een lijn aanzet met potlood. */
function line(parent, [x1, y1], [x2, y2], options = LINE) {
	return sketch(parent, rc.line(x1, y1, x2, y2, { ...options, seed: nextSeed() }), back);
}

/**
 * Cirkel in twee rondjes. Rough.js begint een cirkel bovenaan; `startAngle`
 * (graden, 0 = rechts, 180 = links) draait dat beginpunt naar het raakpunt met de ring.
 */
function circle(parent, [cx, cy], r, startAngle = 0) {
	const node = rc.circle(cx, cy, r * 2, { ...CIRCLE, seed: nextSeed() });

	node.setAttribute('transform', `rotate(${startAngle + 90} ${cx} ${cy})`);

	return sketch(parent, node);
}

/** Arcering van een vlak: losse lijnen, om en om heen en terug. */
function hatch(parent, d, options = HATCH) {
	return sketch(parent, rc.path(d, { ...options, seed: nextSeed() }), back);
}

/* Raster. */

// Hulplijnen lopen iets door buiten het raster, zoals op een bouwtekening.
const OVERSHOOT = 15;

const rowLines = [];
const colLines = [];
const colLabels = [];
const rowLabels = [];

function label(x, y, text) {
	const node = document.createElementNS(SVG_NS, 'text');

	// Handgeschreven letters staan nooit precies recht of precies op hun plek.
	node.setAttribute('class', 'label');
	node.setAttribute('x', x + jitter() * 4);
	node.setAttribute('y', y + jitter() * 4);
	node.setAttribute('transform', `rotate(${jitter() * 7} ${x} ${y})`);
	node.setAttribute('opacity', 0);
	node.textContent = text;
	layers.labels.append(node);

	return node;
}

for (let i = 0; i < COLS.length; i++) {
	colLabels.push(label(i * CELL + CELL / 2, -40, COLS[i]));
	rowLabels.push(label(-40, i * CELL + CELL / 2, i + 1));
}

for (let i = 0; i <= COLS.length; i++) {
	const at = i * CELL;

	// Om en om van links naar rechts en terug: de hand hoeft dan niet steeds terug te springen.
	const [from, to] = i % 2 ? [SIZE + OVERSHOOT, -OVERSHOOT] : [-OVERSHOOT, SIZE + OVERSHOOT];

	rowLines.push(...line(layers.rows, [from, at], [to, at], GRID));
	colLines.push(...line(layers.cols, [at, from], [at, to], GRID));
}

/* Vierkante ring: buitenrand B2–H8, binnenrand één cel naar binnen. */

const outer = outerEdges.map(([from, to]) => line(layers.construction, from, to));
const inner = innerEdges.map(([from, to]) => line(layers.construction, from, to));

/* Cirkels van de twee bogen; het tekenen begint op het raakpunt met de ring. */

const outerCircles = [
	circle(layers.construction, topLeft, R, 180),
	circle(layers.construction, bottomRight, R, 0),
];

const innerCircles = [
	circle(layers.construction, topLeft, INNER, 180),
	circle(layers.construction, bottomRight, INNER, 0),
];

/* Bolletjes: de uiteinden van de S. */

const headCircles = [
	circle(layers.construction, topLeft, HEAD, 180),
	circle(layers.construction, bottomRight, HEAD, 0),
];

/* Verbindingslijnen tussen de cirkels en de bolletjes. */

const neckLines = neckEdges.map(([from, to]) => line(layers.construction, from, to));

/* Ruimtecirkels: de witruimte tussen de S en de twee pijlpunten. */

const gapCircles = [
	circle(layers.construction, topLeft, GAP, 180),
	circle(layers.construction, bottomRight, GAP, 0),
];

/*
 * Pas als alle hulplijnen staan, worden de vlakken gearceerd die samen het icoon vormen.
 * Die arcering blijft staan en draait straks met het icoon mee.
 */

const iconHatch = hatch(layers.shape, iconPath);

/*
 * De eindvorm, overgetrokken met een steviger potlood. Rough.js tekent beide helften van het
 * icoon twee keer (helft 1, helft 2, helft 1, helft 2); hier gaat de hand eerst twee keer
 * rond de ene helft en dan twee keer rond de andere.
 */

const traced = sketch(layers.iconOutline, rc.path(iconPath, { ...TRACE, seed: nextSeed() }));
const iconOutline = traced.length === 4 ? [traced[0], traced[2], traced[1], traced[3]] : traced;

/* Kleurverloop; draait met het icoon mee. De streken van de arcering dragen de kleur. */

const defs = stage.querySelector('defs');
const gradient = document.createElementNS(SVG_NS, 'linearGradient');

gradient.setAttribute('id', 'icon-gradient');
gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
gradient.setAttribute('x1', gradientColors.x1);
gradient.setAttribute('x2', gradientColors.x2);

for (const [offset, color] of [[0, gradientColors.from], [1, gradientColors.to]]) {
	const stop = document.createElementNS(SVG_NS, 'stop');

	stop.setAttribute('offset', offset);
	stop.setAttribute('stop-color', color);
	gradient.append(stop);
}

defs.append(gradient);

const iconColor = hatch(layers.iconFill, iconPath, CRAYON);

/* Tijdlijn. */

/**
 * Streken één voor één tekenen, samen `duration` ms. Langere streken krijgen meer tijd,
 * zodat het potlood overal even snel beweegt.
 */
function draw(tl, strokes, duration, ease = 'inOutSine') {
	const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0);

	for (const stroke of strokes) {
		tracked.push(stroke);

		tl.add(stroke.drawable, {
			opacity: { to: 1, duration: 1 },
			draw: stroke.reversed ? ['1 1', '0 1'] : ['0 0', '0 1'],
			duration: Math.max(1, duration * stroke.length / total),
			ease,
		});
	}

	return tl;
}

/** Vormen één voor één tekenen, elk `duration` ms. */
function drawInOrder(tl, shapes, duration) {
	for (const shape of shapes) {
		draw(tl, shape, duration);
	}

	return tl;
}

const fade = (duration) => ({ opacity: 0, duration, ease: 'inOutSine' });

const steps = [
	{
		name: 'Grid: nine rows',
		build: (tl) => draw(tl, rowLines, 1300, 'inOutQuad'),
	},
	{
		name: 'Grid: nine columns',
		build: (tl) => draw(tl, colLines, 1300, 'inOutQuad'),
	},
	{
		name: 'Columns A–I and rows 1–9',
		build: (tl) => {
			for (const node of [...colLabels, ...rowLabels]) {
				tl.add(node, { opacity: 1, duration: 120, ease: 'linear' }, '<-=50');
			}
		},
	},
	{
		name: 'Outer edge: B2 → H2 → H8 → B8 → B2',
		build: (tl) => drawInOrder(tl, outer, 600),
	},
	{
		name: 'Inner edge: one cell inwards',
		build: (tl) => drawInOrder(tl, inner, 480),
	},
	{
		name: 'Outer circles: top left from B4, bottom right from H6',
		build: (tl) => drawInOrder(tl, outerCircles, 1500),
	},
	{
		name: 'Inner circles: top left from C4, bottom right from G6',
		build: (tl) => drawInOrder(tl, innerCircles, 1100),
	},
	{
		name: 'Dots: one cell around the centres of D4 and F6',
		build: (tl) => drawInOrder(tl, headCircles, 850),
	},
	{
		name: 'Connecting lines: mid D to mid F, in rows 4 and 6',
		build: (tl) => drawInOrder(tl, neckLines, 520),
	},
	{
		name: 'Clearance circles: half a cell outside the outer circles',
		build: (tl) => drawInOrder(tl, gapCircles, 1500),
	},
	{
		name: 'Hatching: only the areas that form the icon',
		build: (tl) => draw(tl, iconHatch, 3000, 'linear'),
	},
	{
		name: 'Trace the icon; every guide disappears',
		build: (tl) => {
			draw(tl, iconOutline.slice(0, 2), 2400);
			draw(tl, iconOutline.slice(2), 2400);

			tl
				.add({ duration: 250 })
				.add(layers.construction, fade(1000));
		},
	},
	{
		name: 'Rotate the icon 45° clockwise',
		// Gedraaid is het icoon √2 keer zo breed; verkleinen met 1/√2 houdt het binnen B t/m H.
		build: (tl) => tl.add('#icon', { rotate: 45, scale: Math.SQRT1_2, duration: 1600, ease: 'inOutCubic' }),
	},
	{
		name: 'Colour in: gradient from #ff0000 to #fab816',
		build: (tl) => draw(tl, iconColor, 5200, 'linear'),
	},
];

/* Potlood. */

const pencil = document.querySelector('#pencil');

/**
 * Zet het potlood op de punt van de streek die nu getekend wordt. Hoe ver een streek is, staat
 * in zijn streepjespatroon (anime.js rekent met een padlengte van 1000); zo klopt het potlood
 * ook bij slepen door de tijdlijn, zonder eigen boekhouding van tijden.
 */
function movePencil() {
	let current = null;
	let progress = 0;

	for (const stroke of tracked) {
		const drawn = parseFloat(stroke.node.getAttribute('stroke-dasharray')) / 1000;

		if (drawn > 0 && drawn < 1) {
			current = stroke;
			progress = drawn;
		}
	}

	if (!current) {
		pencil.setAttribute('opacity', 0);

		return;
	}

	const { node, reversed, length } = current;
	const point = node.getPointAtLength(length * (reversed ? 1 - progress : progress));

	// Van de coördinaten van de streek (die meedraait met het icoon) naar die van het canvas.
	const toStage = stage.getScreenCTM().inverse().multiply(node.getScreenCTM());
	const { x, y } = new DOMPoint(point.x, point.y).matrixTransform(toStage);

	pencil.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
	pencil.setAttribute('opacity', 1);
}

createPlayer(steps, { onUpdate: movePencil });

document.querySelector('#reseed').addEventListener('click', () => {
	location.hash = `seed=${1 + Math.floor(Math.random() * 9999)}`;
	location.reload();
});
