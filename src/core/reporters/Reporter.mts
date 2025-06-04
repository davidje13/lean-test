import type { RunResult, RunResultType } from '../structure.mts';

export interface Reporter {
	eventListener?(event: ReporterEvent): void;
	report?(result: TestRunResult): void;
}

export type ReporterEvent =
	| {
			type: 'begin';
			block: { type: 'test' | 'test-attempt'; path: string[] };
	  }
	| {
			type: 'complete';
			block: { type: 'test' | 'test-attempt'; path: string[] };
			outcome: RunResult;
	  };

export interface TestRunResult {
	summary: Record<RunResultType, number> & {
		count: number;
		duration: number;
	};
	dangling: Set<{ path: string[] }>;
}
