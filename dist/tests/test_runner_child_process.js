// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { TestSuite } from "./test_suite.js";
import { TestResult } from "./test_result.js";
import { Clock } from "../infrastructure/clock.js";
import process from "node:process";
const KEEPALIVE_INTERVAL_IN_MS = 100;
main();
function main() {
    process.on("uncaughtException", (err)=>{
        const errorResult = TestResult.suite([], [
            TestResult.fail("Unhandled error in tests", err)
        ]);
        sendFinalResult(errorResult);
    });
    Clock.create().repeat(KEEPALIVE_INTERVAL_IN_MS, ()=>{
        process.send({
            type: "keepalive"
        });
    });
    process.on("message", (workerData)=>{
        runWorkerAsync(workerData);
    });
}
async function runWorkerAsync({ modulePaths, config }) {
    const suite = await TestSuite.fromModulesAsync(modulePaths);
    const result = await suite.runAsync({
        config,
        notifyFn: sendProgress
    });
    // wait a tick so unhandled promises can be detected
    setImmediate(()=>{
        sendFinalResult(result);
    });
}
function sendProgress(result) {
    process.send({
        type: "progress",
        result: result.serialize()
    });
}
function sendFinalResult(result) {
    process.send({
        type: "complete",
        result: result.serialize()
    });
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/tests/test_runner_child_process.js.map
