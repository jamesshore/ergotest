// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RecursiveRunOptions } from "./test.js";
import { RunResult } from "../results/test_result.js";
import { ItFn, ItOptions } from "./test_suite.js";

export type BeforeAfterDefinition = { name?: string[], options: ItOptions, fnAsync: ItFn };

export class RunnableFunction {

	private _name: string[];
	private _options: ItOptions;
	private _fn: ItFn;

	static create(name: string[], options: ItOptions, fn: ItFn) {
		return new RunnableFunction(name, options, fn);
	}

	constructor(name: string[], options: ItOptions, fn: ItFn) {
		this._name = name;
		this._options = options;
		this._fn = fn;
	}

	get name() {
		return this._name;
	}

	get options() {
		return this._options;
	}

	get fn() {
		return this._fn;
	}
}


export async function runTestFnAsync(
	name: string[],
	fn: ItFn,
	testTimeout: Milliseconds | undefined,
	{ clock, filename, timeout, config, renderError }: RecursiveRunOptions,
): Promise<RunResult> {
	const getConfig = <T>(name: string) => {
		if (config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return config[name] as T;
	};

	timeout = testTimeout ?? timeout;

	return await clock.timeoutAsync(timeout, async () => {
		try {
			await fn({ getConfig });
			return RunResult.pass({ name, filename });
		}
		catch (error) {
			return RunResult.fail({ name, filename, error, renderError });
		}
	}, async () => {
		return await RunResult.timeout({ name, filename, timeout });
	});
}

