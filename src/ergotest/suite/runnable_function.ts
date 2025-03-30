// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RunOptions } from "./test.js";
import { RunResult } from "../results/test_result.js";
import { ItFn } from "../test_api.js";
import { RunData } from "./test_suite.js";


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

