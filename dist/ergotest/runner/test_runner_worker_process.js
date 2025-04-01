// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { importRendererAsync } from "../tests/test_suite.js";
import { RunResult, TestCaseResult, TestSuiteResult } from "../results/test_result.js";
import { Clock } from "../../infrastructure/clock.js";
import process from "node:process";
import { fromModulesAsync } from "./loader.js";
const KEEPALIVE_INTERVAL_IN_MS = 100;
main();
function main() {
    const cancelKeepAliveFn = Clock.create().repeat(KEEPALIVE_INTERVAL_IN_MS, ()=>{
        process.send({
            type: "keepalive"
        });
    });
    process.on("message", (workerData)=>{
        runWorkerAsync(cancelKeepAliveFn, workerData);
    });
    process.on("error", (err)=>{
        if (err?.code === "ERR_IPC_CHANNEL_CLOSED") {
            cancelKeepAliveFn();
            process.stdout.write("Ergotest worker process attempted to send message after IPC channel closed\n" + `Error: ${err?.stack}`);
        } else {
            sendFatalError("Ergotest worker process generated 'error' event", err, cancelKeepAliveFn);
        }
    });
}
async function runWorkerAsync(cancelKeepAliveFn, { modulePaths, timeout, config, renderer }) {
    try {
        const renderError = await importRendererAsync(renderer);
        process.on("uncaughtException", (error)=>{
            const errorResult = TestSuiteResult.create({
                tests: [
                    TestCaseResult.create({
                        it: RunResult.fail({
                            name: [
                                "Unhandled error in tests"
                            ],
                            error,
                            renderError
                        })
                    })
                ]
            });
            sendFinalResult(errorResult, cancelKeepAliveFn);
        });
        const suite = await fromModulesAsync(modulePaths);
        const result = await suite.runAsync({
            timeout,
            config,
            renderer,
            onTestCaseResult: sendProgress
        });
        // wait a tick so unhandled promises can be detected
        setImmediate(()=>{
            sendFinalResult(result, cancelKeepAliveFn);
        });
    } catch (err) {
        sendFatalError("Ergotest worker process encountered exception", err, cancelKeepAliveFn);
    }
}
function sendProgress(result) {
    send({
        type: "progress",
        result: result.serialize()
    });
}
function sendFatalError(message, err, cancelKeepAliveFn) {
    cancelKeepAliveFn();
    send({
        type: "fatal",
        message,
        err
    });
}
function sendFinalResult(result, cancelKeepAliveFn) {
    cancelKeepAliveFn();
    send({
        type: "complete",
        result: result.serialize()
    });
}
function send(message) {
    process.send(message);
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/ergotest/runner/test_runner_worker_process.js.map
