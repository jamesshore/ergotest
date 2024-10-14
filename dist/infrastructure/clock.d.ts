export interface NulledClockConfiguration {
    now?: number | Date;
}
type TimeoutHandle = number;
type Runnable<T> = (() => T) | (() => Promise<T>);
interface ClockGlobals {
    Date: typeof Date;
    setTimeout: (fn: (...args: unknown[]) => void, milliseconds: number) => TimeoutHandle;
    clearTimeout: (handle: TimeoutHandle) => void;
    setInterval: (fn: (...args: unknown[]) => void, milliseconds: number) => TimeoutHandle;
    clearInterval: (handle: TimeoutHandle) => void;
    tickAsync: (milliseconds: number) => void;
    tickUntilTimersExpireAsync: () => void;
}
/** System clock. */
export declare class Clock {
    /**
     * Factory method. Wraps the system clock.
     * @returns {Clock} the wrapped clock
     */
    static create(): Clock;
    /**
     * Factory method. Creates a simulated system clock.
     * @param [options] overridable options for the simulated clock
     * @param {number} [options.now=0] simulated current time
     * @returns {Clock} the simulated clock
     */
    static createNullAsync(options?: NulledClockConfiguration): Promise<Clock>;
    private _globals;
    /** Only for use by tests. (Use a factory method instead.) */
    constructor(globals: ClockGlobals);
    /**
     * @returns {number} the current time in milliseconds (equivalent to `Date.now()`)
     */
    now(): number;
    /**
     * Wait for a certain amount of time has passed. Equivalent to `setTimeout()`, which is not guaranteed to be exact.
     * Special note for nulled clocks: time doesn't pass automatically for nulled clocks, so this method won't return
     * unless one of the tick methods is called.
     * @param {number} milliseconds the approximate number of milliseconds to wait
     */
    waitAsync(milliseconds: number): Promise<void>;
    /**
     * Run a function approximately every N milliseconds. Equivalent to `setInterval()`, which is not guaranteed to be
     * exact. Special note for nulled clocks: time doesn't pass automatically for nulled clocks, so this method won't
     * return unless one of the tick methods is called.
     * @param {number} milliseconds
     * @param {() => void} fn The function to run.
     * @returns {() => void} A function that will cancel the repetition (equivalent to `clearInterval()`).
     */
    repeat(milliseconds: number, fn: () => void): () => void;
    /**
     * The number of milliseconds that have elapsed since a particular time.
     * @param { Date | number } startAsDateOrMilliseconds
     * @returns {number} The elapsed milliseconds.
     */
    millisecondsSince(startAsDateOrMilliseconds: number | Date): number;
    /**
     * The number of milliseconds until a particular time.
     * @param { Date | number } endAsDateOrMilliseconds
     * @returns {number} The milliseconds remaining.
     */
    millisecondsUntil(endAsDateOrMilliseconds: number | Date): number;
    /**
     * A "dead man's switch." Calls `timeoutFn` if `aliveFn` hasn't been called in the last N milliseconds. Special note
     * for nulled clocks: time doesn't pass automatically for nulled clocks, so this method won't time out unless one of
     * the tick methods is called.
     * @param {number} milliseconds The number of milliseconds to wait before calling `timeoutFn`.
     * @param {() => void} timeoutFn The function to call if aliveFn() isn't called after `milliseconds`.
     * @returns {{aliveFn: () => void, cancelFn: () => void}} Call aliveFn() to reset the timeout. Call cancelFn() to
     *   stop the timeout.
     */
    keepAlive(milliseconds: number, timeoutFn: () => void): {
        aliveFn: () => void;
        cancelFn: () => void;
    };
    /**
     * Wait for a promise to resolve and return its value. If it hasn't completed in a certain amount of time, run a
     * timeout function and return its value instead. Note that this DOES NOT CANCEL the original promise, which will
     * still run to completion, although its return value will be discarded. (Promises cannot be cancelled.) Any
     * cancellation mechanism you want to use must be programmed into the promise and timeout function.
     * @template T
     * @param {number} milliseconds the approximate number of milliseconds to wait
     * @param {() => T | Promise<T>} fnAsync the promise to wait for
     * @param {() => T | Promise<T>} timeoutFnAsync the function to run when the time is up
     * @returns {Promise<T>} the promise's return value (if the promise resolves in time) or the timeout function's
     *   return value (if it doesn't)
     */
    timeoutAsync<T>(milliseconds: number, fnAsync: Runnable<T>, timeoutFnAsync: Runnable<T>): Promise<T>;
    /**
     * Advance a nulled clock forward in time. Throws an exception if the clock isn't nulled. (For
     * non-nulled clocks, use waitAsync() instead.)
     * @param {number} milliseconds the number of milliseconds to advance the clock
     */
    tickAsync(milliseconds: number): Promise<void>;
    /**
     * Advance a nulled clock forward in time until all timers expire. Throws an exception if the
     * clock isn't nulled.
     */
    tickUntilTimersExpireAsync(): Promise<void>;
}
export {};
