export default class Writer {
	constructor(writer, forceTTY = null) {
		this.writer = writer;
		this.dynamic = forceTTY ?? writer.isTTY;
		if (this.dynamic) {
			this.colour = (...vs) => {
				const prefix = '\u001B[' + vs.join(';') + 'm';
				return (v) => `${prefix}${v}\u001B[0m`;
			};
		} else {
			this.colour = () => (v, fallback) => (fallback ?? v);
		}
		this.red = this.colour(31);
		this.green = this.colour(32);
		this.yellow = this.colour(33);
		this.blue = this.colour(34);
		this.purple = this.colour(35);
		this.cyan = this.colour(36);
		this.gray = this.colour(37);
		this.redBack = this.colour(41, 38, 5, 231);
		this.greenBack = this.colour(42, 38, 5, 231);
		this.yellowBack = this.colour(43, 38, 5, 231);
		this.blueBack = this.colour(44, 38, 5, 231);
		this.purpleBack = this.colour(45, 38, 5, 231);
		this.cyanBack = this.colour(46, 38, 5, 231);
		this.grayBack = this.colour(47, 38, 5, 231);
		this.bold = this.colour(1);
		this.faint = this.colour(2);

		// grab the write function so that nothing in the tests can intercept it
		this.writeRaw = this.writer.write.bind(this.writer);
	}

	write(v, linePrefix = '', continuationPrefix = null) {
		String(v).split(/\r\n|\n\r?/g).forEach((ln, i) => {
			this.writeRaw(((i ? continuationPrefix : null) ?? linePrefix) + ln + '\n');
		});
	}
}
