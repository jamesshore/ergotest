// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { RunResult } from "../results/test_result.js";
import { RunData, RunOptions } from "./test_suite.js";
import { ItFn, ItOptions } from "./test_api.js";

export class Runnable {

	private readonly _name: string[];
	private readonly _options: ItOptions;
	private readonly _fnAsync?: ItFn;

	static create(name: string[], options: ItOptions, fnAsync?: ItFn) {
		return new Runnable(name, options, fnAsync);
	}

	constructor(name: string[], options: ItOptions, fnAsync: ItFn | undefined) {
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

	get fnAsync(): ItFn | undefined {
		return this._fnAsync;
	}

	async runTestFnAsync(
		runOptions: RunOptions,
		runData: RunData,
	): Promise<RunResult> {
		const fnAsync = this._fnAsync;
		if (runData.skipAll || fnAsync === undefined) {
			return RunResult.skip({
				name: this._name,
				filename: runData.filename
			});
		}

		const timeout = this._options.timeout ?? runData.timeout;
		return await runOptions.clock.timeoutAsync(timeout, async () => {
			try {
				await fnAsync({ getConfig });
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

