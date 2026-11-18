import { createTimeline } from 'animejs';

const PAUSE = 350;

/**
 * Zet de stappen achter elkaar op één tijdlijn en koppelt de bediening onder de animatie.
 *
 * Elke stap heeft een `name` (de tekst onder de animatie) en een `build`-functie die zijn
 * animaties achteraan de tijdlijn toevoegt. `onUpdate` wordt aangeroepen bij elke verandering
 * van de tijdlijn, ook bij slepen en springen.
 */
export function createPlayer(steps, { onUpdate } = {}) {
	const ui = {
		play: document.querySelector('#play'),
		prev: document.querySelector('#prev'),
		next: document.querySelector('#next'),
		restart: document.querySelector('#restart'),
		scrubber: document.querySelector('#scrubber'),
		stepCount: document.querySelector('#step-count'),
		stepName: document.querySelector('#step-name'),
	};

	const timeline = createTimeline({
		autoplay: false,
		onUpdate: syncUi,
		onComplete: syncUi,
	});

	for (const step of steps) {
		step.start = timeline.duration > 1 ? timeline.duration + PAUSE : 0;

		// Lege timer zodat de volgende stap pas na de pauze begint.
		if (step.start > 0) {
			timeline.add({ duration: PAUSE });
		}

		step.build(timeline);
	}

	const duration = timeline.duration;

	ui.scrubber.max = duration;

	function currentStepIndex() {
		const time = timeline.currentTime;
		let index = 0;

		steps.forEach((step, i) => {
			if (time >= step.start) {
				index = i;
			}
		});

		return index;
	}

	function syncUi() {
		const index = currentStepIndex();
		const atEnd = timeline.currentTime >= duration;

		ui.scrubber.value = timeline.currentTime;
		ui.stepCount.textContent = `Step ${index + 1} / ${steps.length}`;
		ui.stepName.textContent = steps[index].name;
		ui.play.textContent = timeline.paused || atEnd ? 'Play' : 'Pause';
		ui.prev.disabled = timeline.currentTime <= 0;
		ui.next.disabled = atEnd;

		onUpdate?.(timeline);
	}

	function seek(time) {
		timeline.pause();
		timeline.seek(Math.max(0, Math.min(duration, time)));
		syncUi();
	}

	ui.play.addEventListener('click', () => {
		if (timeline.currentTime >= duration) {
			timeline.restart();
		} else if (timeline.paused) {
			timeline.play();
		} else {
			timeline.pause();
		}

		syncUi();
	});

	ui.restart.addEventListener('click', () => {
		timeline.restart();
		syncUi();
	});

	// Vorige: naar het begin van de huidige stap, of van de stap ervoor als we daar al staan.
	ui.prev.addEventListener('click', () => {
		const index = currentStepIndex();
		const atStart = timeline.currentTime - steps[index].start < 50;

		seek(steps[Math.max(0, atStart ? index - 1 : index)].start);
	});

	// Volgende: naar het begin van de volgende stap, of na de laatste stap naar het einde.
	ui.next.addEventListener('click', () => {
		const next = steps[currentStepIndex() + 1];

		seek(next ? next.start : duration);
	});

	ui.scrubber.addEventListener('input', () => seek(Number(ui.scrubber.value)));

	// `#t=1200` opent de animatie gepauzeerd op dat tijdstip (ms), handig bij het afstellen.
	const startAt = new URLSearchParams(location.hash.slice(1)).get('t');

	if (startAt !== null) {
		seek(startAt === 'end' ? duration : Number(startAt));
	} else if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
		seek(duration);
	} else {
		timeline.play();
		syncUi();
	}

	return timeline;
}
