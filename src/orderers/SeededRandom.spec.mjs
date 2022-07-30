import SeededRandom from './SeededRandom.mjs';

const SEED1 = '41fa8d97c5f70e550ab5391db9d3b0ed';
const SEED2 = '55e3a5cd5945896a4c187c81a98dd979';

describe('SeededRandom', () => {
	it('generates roughly uniform random numbers in a range', () => {
		const BUCKETS = 100;
		const ITERATIONS = 100000;

		const s = new SeededRandom(SEED1);
		const buckets = repeat(BUCKETS, 0);
		for (let i = 0; i < ITERATIONS; ++i) {
			++buckets[s.next(BUCKETS)];
		}
		const expected = ITERATIONS / BUCKETS;
		const tolerance = expected * 0.25;
		for (let i = 0; i < BUCKETS; ++i) {
			expect(buckets[i], isNear(expected, { tolerance }));
		}
	});

	it('generates the same sequence if given the same seed', () => {
		const s1 = new SeededRandom(SEED1);
		const s2 = new SeededRandom(SEED1);

		const seq1 = repeat(100, () => s1.next());
		const seq2 = repeat(100, () => s2.next());
		expect(seq1, equals(seq2));
	});

	it('generates different sequences if given different seeds', () => {
		const s1 = new SeededRandom(SEED1);
		const s2 = new SeededRandom(SEED2);

		const seq1 = repeat(100, () => s1.next());
		const seq2 = repeat(100, () => s2.next());
		expect(seq1, not(equals(seq2)));
	});

	it('getSeed returns a string representing the normalised seed', () => {
		const s = new SeededRandom(SEED1.toUpperCase());
		expect(s.getSeed(), equals(SEED1));
	});

	describe('constructor', () => {
		it('returns a randomly seeded sequence if given no arguments', { retry: 3 }, () => {
			const s1 = new SeededRandom();
			const s2 = new SeededRandom();

			expect(s1.getSeed(), not(equals(s2.getSeed())));
		});

		it('fails if given a bad seed', () => {
			expect(() => new SeededRandom('nope'), throws('invalid random seed'));
		});
	});

	describe('sub', () => {
		it('returns a new independent sequence', () => {
			const s1 = new SeededRandom(SEED1);
			const s1a = s1.sub();
			const s1b = s1.sub();

			expect(s1a.getSeed(), not(equals(s1.getSeed())));
			expect(s1b.getSeed(), not(equals(s1a.getSeed())));
		});

		it('is deterministic', () => {
			const s1 = new SeededRandom(SEED1);
			const s2 = new SeededRandom(SEED1);
			const s1a = s1.sub();
			const s2a = s2.sub();

			expect(s1a.getSeed(), equals(s2a.getSeed()));
		});
	});

	describe('order', () => {
		it('returns all provided items', { repeat: 5 }, () => {
			const items = repeat(10, (i) => Symbol(i));
			const s = new SeededRandom();
			const ordered = s.order([...items]);

			for (let i = 0; i < items.length; ++i) {
				expect(ordered, contains(items[i]));
			}
		});

		it('shuffles fairly', { retry: 3 }, () => {
			const SIZE = 10;
			const ITERATIONS = 10000;

			const items = repeat(SIZE, (i) => i);
			const occurrences = repeat(SIZE * SIZE, 0);

			for (let i = 0; i < ITERATIONS; ++i) {
				const s = new SeededRandom();
				const ordered = s.order([...items]);
				for (let j = 0; j < SIZE; ++j) {
					++occurrences[j * SIZE + ordered[j]];
				}
			}

			const expected = ITERATIONS / SIZE;
			const tolerance = expected * 0.25;
			for (let i = 0; i < SIZE * SIZE; ++i) {
				expect(occurrences[i], isNear(expected, { tolerance }));
			}
		});
	});
});

function repeat(count, fn) {
	const r = [];
	if (typeof fn !== 'function') {
		const v = fn;
		fn = () => v;
	}
	for (let i = 0; i < count; ++i) {
		r.push(fn(i));
	}
	return r;
}
