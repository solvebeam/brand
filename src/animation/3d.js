import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
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
 * 3D-variant: het icoon wordt eerst plat getekend, daarna blijkt de tekening op een vloer te
 * liggen en groeit het icoon eruit.
 *
 * Anime.js animeert alleen de getallen in `state`; `render()` zet die om naar de scène. Het beeld
 * hangt dus alleen van `state` af, waardoor slepen, stapknoppen en `#t=` vanzelf werken.
 *
 * Assen: het midden van het raster is de oorsprong, x loopt naar rechts, y omhoog en z uit de
 * tekening naar de kijker.
 */

const state = {
	grid: 0,
	ring: 0,
	circles: 0,
	links: 0,
	fill: 0,
	construction: 1,
	outline: 0,
	turn: 0,
	color: 0,
	lit: 0,
	tilt: 0,
	yaw: 0,
	fov: 2,
	frame: SIZE / 2 + 80,
	extrudeA: 0,
	extrudeB: 0,
	beam: 0,
	split: 0,
	spin: 0,
	floor: 1,
};

/* Maten van het massieve icoon, in dezelfde eenheid als het raster. */

const DEPTH = 1.1 * CELL;
const BEVEL = 7;
const LIFT = [2.6 * CELL, 0.6 * CELL];

const OVERSHOOT = 15;
const LINE_STEPS = 24;
const CIRCLE_STEPS = 160;

const degrees = THREE.MathUtils.degToRad;
const { clamp, lerp } = THREE.MathUtils;

/** Punt in het raster (y omlaag, oorsprong linksboven) naar de scène. */
function toScene([x, y], z = 0) {
	return new THREE.Vector3(x - SIZE / 2, SIZE / 2 - y, z);
}

/* Renderer. */

const canvas = document.querySelector('#stage');

function createRenderer() {
	try {
		return new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
	} catch {
		return null;
	}
}

const renderer = createRenderer();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

/* Lijnen: ze tekenen zich door steeds meer segmenten te tonen. */

const gridMaterial = new LineMaterial({ linewidth: 1, transparent: true, depthWrite: false });
const constructionMaterial = new LineMaterial({ linewidth: 1.4, transparent: true, depthWrite: false });
const outlineMaterial = new LineMaterial({ linewidth: 1.4, transparent: true, depthWrite: false });

function polyline(parent, points, material) {
	const geometry = new LineGeometry();

	geometry.setPositions(points.flatMap((point) => [point.x, point.y, point.z]));

	const line = new Line2(geometry, material);

	line.renderOrder = 3;
	parent.add(line);

	return { line, segments: points.length - 1 };
}

function straight(parent, [from, to], material, z) {
	const start = toScene(from, z);
	const end = toScene(to, z);
	const points = [];

	for (let i = 0; i <= LINE_STEPS; i++) {
		points.push(start.clone().lerp(end, i / LINE_STEPS));
	}

	return polyline(parent, points, material);
}

/** Cirkel die begint op `startAngle` (graden, 0 = rechts) en met de klok mee loopt, zoals in de SVG. */
function circle(parent, [cx, cy], r, startAngle, material, z) {
	const points = [];

	for (let i = 0; i <= CIRCLE_STEPS; i++) {
		const angle = degrees(startAngle) + (i / CIRCLE_STEPS) * Math.PI * 2;

		points.push(toScene([cx + r * Math.cos(angle), cy + r * Math.sin(angle)], z));
	}

	return polyline(parent, points, material);
}

function setDrawn({ line, segments }, progress) {
	const count = Math.ceil(clamp(progress, 0, 1) * segments);

	line.visible = count > 0;
	line.geometry.instanceCount = count;
}

/** Tekent lijnen na elkaar; `window` is het deel van de stap dat één lijn duurt. */
function drawSequence(lines, progress, window = 1 / lines.length) {
	const spacing = lines.length > 1 ? (1 - window) / (lines.length - 1) : 0;

	lines.forEach((item, i) => setDrawn(item, (progress - i * spacing) / window));
}

/* Vloer met raster. */

const gridLines = [];

for (const direction of ['row', 'col']) {
	for (let i = 0; i <= COLS.length; i++) {
		const at = i * CELL;
		const from = -OVERSHOOT;
		const to = SIZE + OVERSHOOT;
		const edge = direction === 'row' ? [[from, at], [to, at]] : [[at, from], [at, to]];

		gridLines.push(straight(scene, edge, gridMaterial, 0));
	}
}

const floorMaterial = new THREE.ShadowMaterial({ transparent: true, opacity: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), floorMaterial);

floor.position.z = -0.5;
floor.receiveShadow = true;
scene.add(floor);

/* Het icoon: draait en schaalt als geheel; de hulplijnen en beide helften zitten erin. */

const icon = new THREE.Group();

scene.add(icon);

const ringLines = [...outerEdges, ...innerEdges].map((edge) => straight(icon, edge, constructionMaterial, 1));

const circleLines = [R, INNER, HEAD].flatMap((radius) => [
	circle(icon, topLeft, radius, 180, constructionMaterial, 1),
	circle(icon, bottomRight, radius, 0, constructionMaterial, 1),
]);

const linkLines = [
	...neckEdges.map((edge) => straight(icon, edge, constructionMaterial, 1)),
	circle(icon, topLeft, GAP, 180, constructionMaterial, 1),
	circle(icon, bottomRight, GAP, 0, constructionMaterial, 1),
];

/* Kleurverloop als textuur: per pixel berekend, net als het verloop in de SVG. */

function createGradientTexture() {
	const gradientCanvas = document.createElement('canvas');

	gradientCanvas.width = 512;
	gradientCanvas.height = 1;

	const context = gradientCanvas.getContext('2d');
	const fill = context.createLinearGradient(0, 0, gradientCanvas.width, 0);

	fill.addColorStop(0, gradientColors.from);
	fill.addColorStop(1, gradientColors.to);
	context.fillStyle = fill;
	context.fillRect(0, 0, gradientCanvas.width, 1);

	const texture = new THREE.CanvasTexture(gradientCanvas);

	texture.colorSpace = THREE.SRGBColorSpace;
	texture.generateMipmaps = false;
	texture.minFilter = THREE.LinearFilter;

	return texture;
}

const gradientTexture = createGradientTexture();

/** Zet de plek in het kleurverloop in de uv's: alleen x in het ongedraaide icoon telt. */
function applyGradientUvs(geometry) {
	const position = geometry.getAttribute('position');
	const uv = new Float32Array(position.count * 2);

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i) + SIZE / 2;

		uv[i * 2] = clamp((x - gradientColors.x1) / (gradientColors.x2 - gradientColors.x1), 0, 1);
		uv[i * 2 + 1] = 0.5;
	}

	geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/* De twee helften van het icoon, als omtrek in scènecoördinaten. */

function halfOutlines() {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${iconPath}"/></svg>`;
	const [path] = new SVGLoader().parse(svg).paths;

	return path.toShapes().map((shape) => {
		const points = [];

		for (const point of shape.extractPoints(40).shape) {
			const next = toScene([point.x, point.y]);

			if (!points.length || points.at(-1).distanceTo(next) > 0.01) {
				points.push(next);
			}
		}

		if (points[0].distanceTo(points.at(-1)) < 0.01) {
			points.pop();
		}

		return points;
	});
}

/**
 * De afschuining mag zacht overlopen, maar haar normalen mogen niet doorlekken in de grote vlakken:
 * dan worden de lange driehoeken van de boven- en onderkant en de wanden zichtbaar.
 */
function straightenFlatNormals(geometry) {
	const position = geometry.getAttribute('position');
	const normal = geometry.getAttribute('normal');
	const vector = new THREE.Vector3();
	const near = (a, b) => Math.abs(a - b) < 0.001;

	for (let i = 0; i < position.count; i += 3) {
		const corners = [i, i + 1, i + 2];
		const heights = corners.map((corner) => position.getZ(corner));
		const isCap = heights.every((z) => near(z, 0) || near(z, DEPTH)) && near(heights[0], heights[1]) && near(heights[1], heights[2]);
		const isWall = heights.every((z) => z > BEVEL - 0.001 && z < DEPTH - BEVEL + 0.001) && !near(Math.min(...heights), Math.max(...heights));

		for (const corner of corners) {
			if (isCap) {
				normal.setXYZ(corner, 0, 0, heights[0] > 0 ? 1 : -1);
			} else if (isWall) {
				vector.fromBufferAttribute(normal, corner).setZ(0).normalize();
				normal.setXYZ(corner, vector.x, vector.y, 0);
			}
		}
	}
}

/**
 * Massieve helft op volle diepte. De morph target schuift de bovenkant omlaag, zodat de helft
 * kan groeien zonder dat de afschuining vervormt. De negatieve `bevelOffset` houdt het silhouet
 * gelijk aan het logo.
 */
function solidGeometry(shape) {
	const extruded = new THREE.ExtrudeGeometry(shape, {
		depth: DEPTH - BEVEL * 2,
		steps: 1,
		bevelEnabled: true,
		bevelThickness: BEVEL,
		bevelSize: BEVEL,
		bevelOffset: -BEVEL,
		bevelSegments: 4,
	});

	extruded.translate(0, 0, BEVEL);
	extruded.clearGroups();

	// Bogen glad, hoeken scherp.
	const geometry = toCreasedNormals(extruded, degrees(40));

	straightenFlatNormals(geometry);

	const position = geometry.getAttribute('position');
	const down = new Float32Array(position.count * 3);

	for (let i = 0; i < position.count; i++) {
		if (position.getZ(i) > DEPTH / 2) {
			down[i * 3 + 2] = BEVEL * 2 - DEPTH;
		}
	}

	geometry.morphAttributes.position = [new THREE.BufferAttribute(down, 3)];
	geometry.morphTargetsRelative = true;
	applyGradientUvs(geometry);

	return geometry;
}

const solidMaterial = new THREE.MeshPhysicalMaterial({
	map: gradientTexture,
	roughness: 0.46,
	metalness: 0,
	specularIntensity: 0.5,
	clearcoat: 0.35,
	clearcoatRoughness: 0.22,
});

const shapeMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
const flatMaterial = new THREE.MeshBasicMaterial({
	map: gradientTexture,
	transparent: true,
	depthWrite: false,
	toneMapped: false,
});

const halves = halfOutlines().map((points) => {
	const group = new THREE.Group();
	const shape = new THREE.Shape(points.map(({ x, y }) => new THREE.Vector2(x, y)));

	const solid = new THREE.Mesh(solidGeometry(shape), solidMaterial);

	solid.castShadow = true;
	solid.receiveShadow = true;

	// Platte lagen voor de tekenfase; ze liggen op de bovenkant en gaan mee omhoog.
	const flat = new THREE.Group();
	const flatGeometry = new THREE.ShapeGeometry(shape);

	applyGradientUvs(flatGeometry);

	const shapeLayer = new THREE.Mesh(flatGeometry, shapeMaterial);
	const gradientLayer = new THREE.Mesh(flatGeometry, flatMaterial);

	shapeLayer.renderOrder = 1;
	gradientLayer.renderOrder = 2;
	flat.add(shapeLayer, gradientLayer);
	polyline(flat, [...points, points[0]], outlineMaterial);

	group.add(solid, flat);
	icon.add(group);

	return { group, solid, flat };
});

/* Licht: vooral diffuus, want te veel weerspiegeling spoelt de merkkleuren uit. */

const ambient = new THREE.AmbientLight('#ffffff', 0);

scene.add(ambient);

const sun = new THREE.DirectionalLight('#ffffff', 0);

sun.position.set(-420, 520, 1100);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -900;
sun.shadow.camera.right = 900;
sun.shadow.camera.top = 900;
sun.shadow.camera.bottom = -900;
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 2600;
sun.shadow.radius = 5;
sun.shadow.normalBias = 1.5;
scene.add(sun);

// De bundel strijkt laag over het icoon en trekt een glansstreep over de randen.
const beam = new THREE.SpotLight('#fff4dc', 0, 0, degrees(7), 0.7, 0);

scene.add(beam, beam.target);

/* Thema: de kleuren komen uit dezelfde CSS-variabelen als de andere varianten. */

function cssColor(name) {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	const rgba = value.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);

	if (rgba) {
		return { color: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`, alpha: Number(rgba[4]) };
	}

	return { color: value, alpha: 1 };
}

let gridAlpha = 1;
let shadowStrength = 0.3;

function applyTheme() {
	const grid = cssColor('--grid-line');
	const outline = cssColor('--outline');

	gridAlpha = grid.alpha;
	gridMaterial.color.set(grid.color);
	constructionMaterial.color.set(outline.color);
	outlineMaterial.color.set(outline.color);
	shapeMaterial.color.set(cssColor('--shape').color);
	shadowStrength = matchMedia('(prefers-color-scheme: dark)').matches ? 0.55 : 0.3;
}

/* Beeld opbouwen uit `state`. */

// Rondkijken na afloop; komt bovenop de camerastand uit de tijdlijn.
const orbit = { yaw: 0, pitch: 0 };

function updateCamera() {
	const polar = clamp(degrees(state.tilt) + orbit.pitch, 0, degrees(85));
	const azimuth = degrees(state.yaw) + orbit.yaw;

	// De afstand volgt de lens, zodat het beeld even groot blijft (dolly zoom).
	const distance = state.frame / Math.tan(degrees(state.fov) / 2);
	const target = new THREE.Vector3(0, 0, state.split * 1.2 * CELL + (state.lit * DEPTH) / 4);
	const sinPolar = Math.sin(polar);
	const cosPolar = Math.cos(polar);

	camera.fov = state.fov;
	camera.aspect = 1;
	camera.near = Math.max(10, distance - 2500);
	camera.far = distance + 3000;
	camera.position.set(
		target.x + distance * sinPolar * Math.sin(azimuth),
		target.y - distance * sinPolar * Math.cos(azimuth),
		target.z + distance * cosPolar,
	);
	camera.up.set(-cosPolar * Math.sin(azimuth), cosPolar * Math.cos(azimuth), sinPolar);
	camera.lookAt(target);
	camera.updateProjectionMatrix();
}

function render() {
	drawSequence(gridLines, state.grid, 0.2);
	drawSequence(ringLines, state.ring, 0.25);
	drawSequence(circleLines, state.circles, 0.3);
	drawSequence(linkLines, state.links, 0.3);

	gridMaterial.opacity = gridAlpha * state.floor;
	constructionMaterial.opacity = state.construction;
	outlineMaterial.opacity = state.outline;

	const flatOpacity = 1 - state.lit;

	shapeMaterial.opacity = state.fill * 0.3 * flatOpacity;
	flatMaterial.opacity = state.color * flatOpacity;

	icon.rotation.z = -state.turn * (Math.PI / 4);
	icon.scale.setScalar(lerp(1, Math.SQRT1_2, state.turn));

	halves.forEach(({ group, solid, flat }, i) => {
		const extrude = i === 0 ? state.extrudeA : state.extrudeB;

		solid.visible = state.lit > 0;
		solid.morphTargetInfluences[0] = 1 - extrude;

		flat.visible = flatOpacity > 0;
		flat.position.z = state.lit > 0 ? BEVEL * 2 + extrude * (DEPTH - BEVEL * 2) + 0.5 : 0.5;

		group.position.z = state.split * LIFT[i];
		group.rotation.z = state.spin * Math.PI * 2 * (i === 0 ? 1 : -1);
	});

	floorMaterial.opacity = shadowStrength * state.lit;
	scene.environmentIntensity = 0.2 * state.lit;
	ambient.intensity = 1.5 * state.lit;
	sun.intensity = 1.05 * state.lit;

	const sweep = lerp(-760, 760, state.beam);

	beam.intensity = 16 * Math.sin(state.beam * Math.PI);
	beam.position.set(sweep - 260, -1250, 420);
	beam.target.position.set(sweep, 0, 50);

	updateCamera();
	renderer.render(scene, camera);
}

function resize() {
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
	render();
}

/* Slepen om rond te kijken, alleen als de animatie is afgelopen. */

function enableOrbit() {
	let atEnd = false;
	let dragFrom = null;

	canvas.addEventListener('pointerdown', (event) => {
		if (atEnd) {
			dragFrom = [event.clientX, event.clientY];
			canvas.setPointerCapture(event.pointerId);
			canvas.classList.add('is-dragging');
		}
	});

	canvas.addEventListener('pointermove', (event) => {
		if (!dragFrom) {
			return;
		}

		orbit.yaw -= (event.clientX - dragFrom[0]) * 0.008;
		orbit.pitch = clamp(orbit.pitch - (event.clientY - dragFrom[1]) * 0.006, -degrees(state.tilt), degrees(60));
		dragFrom = [event.clientX, event.clientY];
		render();
	});

	for (const type of ['pointerup', 'pointercancel']) {
		canvas.addEventListener(type, () => {
			dragFrom = null;
			canvas.classList.remove('is-dragging');
		});
	}

	return (timeline) => {
		atEnd = timeline.currentTime >= timeline.duration;
		canvas.classList.toggle('can-orbit', atEnd);

		if (!atEnd) {
			orbit.yaw = 0;
			orbit.pitch = 0;
			dragFrom = null;
		}
	};
}

/* Tijdlijn. */

const steps = [
	{
		name: 'Grid: nine rows and nine columns',
		build: (tl) => tl.add(state, { grid: 1, duration: 1100, ease: 'linear' }),
	},
	{
		name: 'Square ring: outer and inner edge',
		build: (tl) => tl.add(state, { ring: 1, duration: 1100, ease: 'linear' }),
	},
	{
		name: 'Circles: outer circles, inner circles and dots',
		build: (tl) => tl.add(state, { circles: 1, duration: 1900, ease: 'linear' }),
	},
	{
		name: 'Connecting lines and clearance circles',
		build: (tl) => tl.add(state, { links: 1, duration: 1400, ease: 'linear' }),
	},
	{
		name: 'Fill: the guides disappear, the shape remains',
		build: (tl) => tl.add(state, {
			fill: 1,
			outline: 1,
			construction: 0,
			duration: 1000,
			ease: 'inOutSine',
		}),
	},
	{
		name: 'Rotate the icon 45° and apply the gradient',
		build: (tl) => tl
			.add(state, { turn: 1, duration: 1300, ease: 'inOutCubic' })
			.add(state, { color: 1, outline: 0, duration: 800, ease: 'inOutSine' }),
	},
	{
		name: 'The drawing turns out to lie on a floor',
		build: (tl) => tl.add(state, {
			tilt: 56,
			yaw: -24,
			fov: 32,
			frame: 470,
			lit: 1,
			duration: 2100,
			ease: 'inOutCubic',
		}),
	},
	{
		name: 'The two halves grow out of the floor',
		build: (tl) => tl
			.add(state, { extrudeA: 1, duration: 900, ease: 'outBack(1.6)' })
			.add(state, { extrudeB: 1, duration: 900, ease: 'outBack(1.6)' }, '<<+=260'),
	},
	{
		name: 'A beam of light sweeps across the icon',
		build: (tl) => tl.add(state, {
			beam: 1,
			yaw: 14,
			duration: 2200,
			ease: 'inOutSine',
		}),
	},
	{
		name: 'The halves separate, turn a full rotation and click back',
		build: (tl) => tl
			.add(state, { split: 1, tilt: 68, frame: 600, duration: 800, ease: 'inOutCubic' })
			.add(state, { spin: 1, yaw: -8, duration: 1500, ease: 'inOutCubic' })
			.add(state, { split: 0, frame: 470, duration: 650, ease: 'outBounce' }),
	},
	{
		name: 'Final view: drag to look around',
		build: (tl) => tl.add(state, {
			tilt: 24,
			yaw: -12,
			fov: 26,
			frame: 500,
			floor: 0,
			duration: 1900,
			ease: 'inOutCubic',
		}),
	},
];

/* Starten. */

if (renderer) {
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.shadowMap.enabled = true;

	const environment = new THREE.PMREMGenerator(renderer);

	scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture;
	environment.dispose();

	applyTheme();

	const updateOrbit = enableOrbit();

	createPlayer(steps, {
		onUpdate: (timeline) => {
			updateOrbit(timeline);
			render();
		},
	});

	new ResizeObserver(resize).observe(canvas);

	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		applyTheme();
		render();
	});
} else {
	document.body.classList.add('no-webgl');
}
