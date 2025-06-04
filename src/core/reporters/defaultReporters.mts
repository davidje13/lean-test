import { Dots } from './Dots.mts';
import { Live } from './Live.mts';
import type { Reporter } from './Reporter.mts';
import { Summary } from './Summary.mts';

export const defaultLocalReporters: Reporter[] = [new Live(), new Summary()];
//export const defaultLocalReporters: Reporter[] = [
//	new Dots(),
//	new ErrorList(),
//	new Summary(),
//];
export const defaultLocalRedirectedOutputReporters: Reporter[] = [
	new Dots(),
	new Live(),
	new Summary(),
];
export const defaultCIReporters: Reporter[] = [new Live(), new Summary()];
