import { TestRunner } from "ergotest/test_runner.js";
import path from "node:path";

const args = process.argv.slice(2);
const files = args.map(arg => path.resolve(process.cwd(), arg));

process.stdout.write("Running tests: ");
const result = await TestRunner.create().runInChildProcessAsync(files, { onTestCaseResult: reportProgress });
console.log("\n" + result.render("\n") + "\n");

function reportProgress(testCase) {
  process.stdout.write(testCase.renderAsCharacter());
}