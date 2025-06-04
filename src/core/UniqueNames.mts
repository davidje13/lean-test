export class UniqueNames {
	private readonly observed = new Set<string>();

	getName(proposed: string): string {
		if (!this.observed.has(proposed)) {
			this.observed.add(proposed);
			return proposed;
		}
		for (let n = 2; ; ++n) {
			const attempt = `${proposed}-${n}`;
			if (!this.observed.has(attempt)) {
				this.observed.add(attempt);
				return attempt;
			}
		}
	}
}
