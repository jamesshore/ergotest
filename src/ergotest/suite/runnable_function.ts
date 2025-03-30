// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { Milliseconds, RecursiveRunOptions } from "./test.js";
import { RunResult } from "../results/test_result.js";
import { ItFn } from "../test_api.js";


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

