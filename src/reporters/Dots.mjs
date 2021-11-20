export default class Dots {
	constructor(output) {
		this.output = output;
		this.lineLimit = 50;
		this.blockSep = 10;
		this.count = 0;
		this.eventListener = this.eventListener.bind(this);
	}

	eventListener(event) {
		if (event.type === 'complete') {
			if (!event.parent) {
				// whole test run complete
				this.output.writeRaw('\n\n');
				return;
			}
			const { summary } = event;
			if (event.isBlock) {
				if (summary.count || (!summary.error && !summary.fail)) {
					// do not care about block-level events unless they failed without running any children
					return;
				}
			}
			let marker = null;
			if (summary.error) {
				marker = this.output.redBack('!');
			} else if (summary.fail) {
				marker = this.output.redBack('X');
			} else if (summary.pass) {
				marker = this.output.green('*');
			} else if (summary.skip) {
				marker = this.output.yellow('-');
			} else {
				marker = this.output.yellow('-');
			}
			this.output.writeRaw(marker);
			++this.count;
			if ((this.count % this.lineLimit) === 0) {
				this.output.writeRaw('\n');
			} else if ((this.count % this.blockSep) === 0) {
				this.output.writeRaw(' ');
			}
		}
	}
}
