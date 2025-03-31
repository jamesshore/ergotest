// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RunOptions } from "./test.js";
import { RunResult, TestMark } from "../results/test_result.js";
import { ItFn, ItOptions } from "../test_api.js";
import { RunData } from "./test_suite.js";


export class Runnable {

	private readonly _name: string[];
	private readonly _options: ItOptions;
	private readonly _fnAsync: ItFn;

	constructor(name: string[], options: ItOptions, fnAsync: ItFn) {
		this._name = name;
		this._options = options;
		this._fnAsync = fnAsync;
	}

	get name(): string[] {
		return this._name;
	}

	get options(): ItOptions {
		return this._options;
	}

	get fnAsync(): ItFn {
		return this._fnAsync;
	}

	async _runTestFnAsync(
		runOptions: RunOptions,
		runData: RunData,
	): Promise<RunResult> {
		const timeout = this._options.timeout ?? runData.timeout;

		return await runOptions.clock.timeoutAsync(timeout, async () => {
			try {
				await this._fnAsync({ getConfig });
				return RunResult.pass({
					name: this._name,
					filename: runData.filename
				});
			}
			catch (error) {
				return RunResult.fail({
					name: this._name,
					filename: runData.filename,
					error,
					renderError: runOptions.renderError
				});
			}
		}, async () => {
			return await RunResult.timeout({
				name: this._name,
				filename: runData.filename,
				timeout: runData.timeout
			});
		});

		function getConfig<T>(name: string) {
			if (runOptions.config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
			return runOptions.config[name] as T;
		}
	}

}

export async function runTestFnAsync(
	name: string[],
	fn: ItFn,
	testTimeout: Milliseconds | undefined,
	runOptions: RunOptions,
	parentData: RunData,
): Promise<RunResult> {
	const timeout = testTimeout ?? parentData.timeout;

	return await runOptions.clock.timeoutAsync(timeout, async () => {
		try {
			await fn({ getConfig });
			return RunResult.pass({ name, filename: parentData.filename });
		}
		catch (error) {
			return RunResult.fail({ name, filename: parentData.filename, error, renderError: runOptions.renderError });
		}
	}, async () => {
		return await RunResult.timeout({ name, filename: parentData.filename, timeout: parentData.timeout });
	});

	function getConfig<T>(name: string) {
		if (runOptions.config[name] === undefined) throw new Error(`No test config found for name '${name}'`);
		return runOptions.config[name] as T;
	}
}

