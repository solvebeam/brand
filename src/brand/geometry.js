/**
 * De maten van het SolveBeam-icoon, gedeeld door de strakke animatie, de schetsvariant en de 3D-variant.
 *
 * Raster: 9 × 9 cellen van 100 in een document van 900 × 900.
 * Kolommen A–I lopen van links naar rechts, rijen 1–9 van boven naar beneden.
 */
export const CELL = 100;
export const COLS = 'ABCDEFGHI';
export const SIZE = CELL * COLS.length;

/**
 * Cel in rasternotatie naar coördinaten, bijvoorbeeld `cell('B2')`:
 * `x`/`y` is de linkerbovenhoek, `right`/`bottom` de rechteronderhoek.
 */
export function cell(name) {
	const x = COLS.indexOf(name[0]) * CELL;
	const y = (Number(name.slice(1)) - 1) * CELL;

	return { x, y, right: x + CELL, bottom: y + CELL };
}

/*
 * Middelpunten van de twee bogen: midden van D4 (linksboven) en midden van F6 (rechtsonder).
 */

const d4 = cell('D4');
const d6 = cell('D6');
const f6 = cell('F6');

export const topLeft = [d4.x + CELL / 2, d4.y + CELL / 2];
export const bottomRight = [f6.x + CELL / 2, f6.y + CELL / 2];

const [tlx, tly] = topLeft;
const [brx, bry] = bottomRight;

/*
 * Stralen rond die twee middelpunten.
 * Buitencirkel r = 2,5 cel: raakt links de linkerkant van B4, rechts de rechterkant van H6.
 * Binnencirkel r = 1,5 cel: raakt links de linkerkant van C4, rechts de rechterkant van G6.
 * Bolletje r = 1 cel: de uiteinden van de S.
 * Ruimtecirkel r = 3 cel, een halve cel buiten de buitencirkel: bepaalt de witruimte
 * tussen de S en de twee pijlpunten.
 */

export const R = 2.5 * CELL;
export const INNER = 1.5 * CELL;
export const HEAD = CELL;
export const GAP = 3 * CELL;

/* Vierkante ring: buitenrand B2–H8, binnenrand één cel naar binnen. */

const b2 = cell('B2');
const h2 = cell('H2');
const h8 = cell('H8');
const b8 = cell('B8');

/** Lijnstukken als `[[x1, y1], [x2, y2]]`, in tekenvolgorde. */
export const outerEdges = [
	[[b2.x, b2.y], [h2.right, h2.y]], // B2–H2, bovenkant
	[[h2.right, h2.y], [h8.right, h8.bottom]], // H2–H8, rechterkant
	[[h8.right, h8.bottom], [b8.x, b8.bottom]], // H8–B8, onderkant
	[[b8.x, b8.bottom], [b2.x, b2.y]], // B8–B2, linkerkant
];

export const innerEdges = [
	[[b2.right, b2.bottom], [h2.x, h2.bottom]], // B2–H2, onderkant
	[[h2.x, h2.bottom], [h8.x, h8.y]], // H3–H7, linkerkant
	[[h8.x, h8.y], [b8.right, b8.y]], // H7–B7, bovenkant
	[[b8.right, b8.y], [b2.right, b2.bottom]], // B7–B3, rechterkant
];

/*
 * Verbindingslijnen: boven- en onderkant van rij 4 en rij 6, van halverwege kolom D tot halverwege kolom F.
 * In rij 4 sluiten ze bij F aan op de bovenkant van de buiten- en binnencirkel rechtsonder,
 * in rij 6 bij D op de onderkant van de buiten- en binnencirkel linksboven.
 */

export const neckEdges = [
	[[tlx, d4.y], [brx, d4.y]], // D4–F4, bovenkant
	[[tlx, d4.bottom], [brx, d4.bottom]], // D4–F4, onderkant
	[[tlx, d6.y], [brx, d6.y]], // D6–F6, bovenkant
	[[tlx, d6.bottom], [brx, d6.bottom]], // D6–F6, onderkant
];

/*
 * De eindvorm van het icoon, nog ongedraaid: twee helften die elk bestaan uit een boog met staart,
 * nek en bolletje, plus de pijlpunt in de hoek waar de staart eindigt (H2 en B8).
 *
 * Linksboven: buitencirkel van D2 linksom naar D6, nek naar het bolletje op F6 en terug,
 * binnencirkel terug naar D3, staart over rij 2 naar H2, pijlpunt omlaag langs kolom H tot de
 * ruimtecirkel van de andere boog. Rechtsonder is hetzelfde, een halve slag gedraaid.
 */

// Waar de nek (een halve cel boven en onder het midden) de cirkel van het bolletje snijdt.
const neck = Math.sqrt(HEAD ** 2 - (CELL / 2) ** 2);

// Waar de ruimtecirkel de binnen- en buitenkant van de pijlpunt snijdt.
const gapInner = Math.sqrt(GAP ** 2 - INNER ** 2);
const gapOuter = Math.sqrt(GAP ** 2 - R ** 2);

export const iconPath = [
	`M${tlx} ${b2.y}`,
	`A${R} ${R} 0 0 0 ${tlx} ${d6.bottom}`,
	`H${brx - neck}`,
	`A${HEAD} ${HEAD} 0 1 0 ${brx - neck} ${d6.y}`,
	`H${tlx}`,
	`A${INNER} ${INNER} 0 0 1 ${tlx} ${h2.bottom}`,
	`H${h2.x}`,
	`V${bry - gapInner}`,
	`A${GAP} ${GAP} 0 0 1 ${h2.right} ${bry - gapOuter}`,
	`V${h2.y}`,
	'Z',

	`M${brx} ${b8.bottom}`,
	`A${R} ${R} 0 0 0 ${brx} ${d4.y}`,
	`H${tlx + neck}`,
	`A${HEAD} ${HEAD} 0 1 0 ${tlx + neck} ${d4.bottom}`,
	`H${brx}`,
	`A${INNER} ${INNER} 0 0 1 ${brx} ${b8.y}`,
	`H${b8.right}`,
	`V${tly + gapInner}`,
	`A${GAP} ${GAP} 0 0 1 ${b8.x} ${tly + gapOuter}`,
	`V${b8.bottom}`,
	'Z',
].join(' ');

/*
 * Kleurverloop van rood naar "Master Nacho". Vóór het draaien loopt het horizontaal van de linkerkant
 * van B naar de rechterkant van H; het draait met het icoon mee en loopt dan van linksboven naar rechtsonder.
 */
export const gradient = {
	x1: b2.x,
	x2: h2.right,
	from: '#ff0000',
	to: '#fab816',
};
