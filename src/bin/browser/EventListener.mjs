export default class EventListener {
	constructor() {
		this.listeners = new Map();
		this.eventQueue = [];
		this.nextID = 0;

		this.handle = this.handle.bind(this);
	}

	getUniqueID() {
		return (this.nextID++);
	}

	hasQueuedEvents(id) {
		const normID = String(id);
		return this.eventQueue.some((e) => (e.id === normID));
	}

	addListener(id, fn) {
		const normID = String(id);
		this.listeners.set(normID, fn);
		const events = [];
		for (let i = 0; i < this.eventQueue.length; ++i) {
			if (this.eventQueue[i].id === normID) {
				events.push(...this.eventQueue[i].events);
				this.eventQueue.splice(i, 1);
				--i;
			}
		}
		events.forEach(fn);
	}

	handle({ id, events }) {
		const normID = String(id);
		const listener = this.listeners.get(normID);
		if (listener) {
			events.forEach(listener);
		} else {
			this.eventQueue.push({ id: normID, events });
		}
	}

	unhandled() {
		if (!this.eventQueue.length) {
			return 'none';
		}
		return this.eventQueue.map(({ id, events }) => `'${id}' (${events.length})`).join(', ');
	}
}
