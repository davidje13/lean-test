export default class ActiveTestTracker {
	constructor() {
		this.active = new Map();
		this.eventListener = (event) => {
			if (event.type === 'begin') {
				this.active.set(event.id, event);
			} else if (event.type === 'complete') {
				this.active.delete(event.id);
			}
		};
	}

	get() {
		const result = [];
		this.active.forEach((beginEvent) => {
			if (!beginEvent.isBlock) {
				const parts = [];
				for (let e = beginEvent; e; e = this.active.get(e.parent)) {
					if (e.label !== null) {
						parts.push(e.label);
					}
				}
				result.push(parts.reverse());
			}
		});
		return result;
	}
}
