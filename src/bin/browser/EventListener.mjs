export default class EventListener {
	constructor() {
		this.listeners = new Map();
		this.eventQueue = [];

		this.handle = this.handle.bind(this);
	}

	addListener(id, fn) {
		this.listeners.set(String(id), fn);
		const events = [];
		for (let i = 0; i < this.eventQueue.length; ++i) {
			if (this.eventQueue[i].id === id) {
				events.push(...this.eventQueue[i].events);
				this.eventQueue.splice(i, 1);
				--i;
			}
		}
		events.forEach(fn);
	}

	handle({ id, events }) {
		const listener = this.listeners.get(String(id));
		if (listener) {
			events.forEach(listener);
		} else {
			this.eventQueue.push({ id, events });
		}
	}
}
