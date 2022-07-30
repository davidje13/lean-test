const CHARS_PER_INT = 8;
const SEED_LENGTH = CHARS_PER_INT * 4;
const VALID_SEED = new RegExp(`^[0-9A-Fa-f]{${SEED_LENGTH}}$`);

export default class SeededRandom {
	constructor(seed) {
		this.s = new Uint32Array(4);

		if (!seed) {
			// secure randomness is not required here, and crypto API is not identical in NodeJS vs browser APIs
			for (let i = 0; i < 4; ++i) {
				this.s[i] = Math.random() * 0x100000000;
			}
		} else if (typeof seed === 'string') {
			seed = seed.padStart(SEED_LENGTH, '0');
			if (!VALID_SEED.test(seed)) {
				throw new Error('invalid random seed');
			}
			for (let i = 0; i < 4; ++i) {
				this.s[i] = Number.parseInt(seed.substr(i * CHARS_PER_INT, CHARS_PER_INT), 16);
			}
		} else if (seed instanceof SeededRandom) {
			for (let i = 0; i < 4; ++i) {
				this.s[i] = seed.next(0x100000000);
			}
		} else {
			throw new Error('invalid random seed');
		}
	}

	getSeed() {
		return [...this.s].map((v) => v.toString(16).padStart(8, '0')).join('');
	}

	next(range = 0x100000000) {
		let x0 = this.s[0];
		let x1 = this.s[1];
		const y0 = this.s[2];
		const y1 = this.s[3];
		this.s[0] = y0;
		this.s[1] = y1;
		x0 ^= (x0 << 23) | (x1 >>> 9);
		x1 ^= (x1 << 23);
		this.s[2] = x0 ^ y0 ^ (x0 >>> 17) ^ (y0 >>> 26);
		this.s[3] = x1 ^ y1 ^ (x0 << 15 | x1 >>> 17) ^ (y0 << 6 | y1 >>> 26);
		return ((this.s[3] + y1) >>> 0) % range;
	}

	order(list) {
		for (let i = list.length; (i--) > 1;) {
			const j = this.next(i + 1);
			const temp = list[i];
			list[i] = list[j];
			list[j] = temp;
		}
		return list;
	}

	sub() {
		return new SeededRandom(this);
	}
}
