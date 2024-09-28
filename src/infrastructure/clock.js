// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const FakeTimers = require("@sinonjs/fake-timers");
const ensure = require("util/ensure");

const FAKE_START_TIME = 0;

/** System clock. */
module.exports = class Clock {

	/**
	 * Factory method. Wraps the system clock.
	 * @returns {Clock} the wrapped clock
	 */
	static create() {
		ensure.signature(arguments, []);

		return new Clock({
			Date,
			setTimeout,
			clearTimeout,
			setInterval,
			clearInterval,
			tickAsync() { throw new Error("Can't advance the clock because it isn't a null clock"); },
			tickUntilTimersExpireAsync() { throw new Error("Can't advance the clock because it isn't a null clock"); }
		});
	}

	/**
	 * Factory method. Creates a simulated system clock.
	 * @param [options] overridable options for the simulated clock
	 * @param {number} [options.now=0] simulated current time
	 * @returns {Clock} the simulated clock
	 */
	static createNull(options) {
		return new Clock(nullGlobals(options));
	}

	/** Only for use by tests. (Use a factory method instead.) */
	constructor(globals) {
		this._globals = globals;
	}

	/**
	 * @returns {number} the current time in milliseconds (equivalent to `Date.now()`)
	 */
	now() {
		ensure.signature(arguments, []);
		return this._globals.Date.now();
	}

	/**
	 * @returns {number} the current year, assuming UTC time zone
	 */
	currentYearForUtc() {
		ensure.signature(arguments, []);
		return new Date(this._globals.Date.now()).getUTCFullYear();
	}

	/**
	 * Wait for a certain amount of time has passed. Equivalent to `setTimeout()`, which is not guaranteed to be exact. Special note for nulled clocks: time doesn't pass automatically for nulled clocks, so this method won't return unless one of the tick methods is called.
	 * @param {number} milliseconds the approximate number of milliseconds to wait
	 */
	async waitAsync(milliseconds) {
		ensure.signature(arguments, [ Number ]);
		await new Promise((resolve) => {
			this._globals.setTimeout(resolve, milliseconds);
		});
	}

	/**
	 * Run a function approximately every N milliseconds. Equivalent to `setInterval()`, which is not guaranteed to be exact. Special note for nulled clocks: time doesn't pass automatically for nulled clocks, so this method won't return unless one of the tick methods is called.
	 * @param {number} milliseconds
	 * @param {() => void} fn The function to run.
	 * @returns {() => void} A function that will cancel the repetition (equivalent to `clearInterval()`).
	 */
	repeat(milliseconds, fn) {
		ensure.signature(arguments, [ Number, Function ]);

		const handle = this._globals.setInterval(fn, milliseconds);
		return () => this._globals.clearInterval(handle);
	}

	/**
	 * The number of milliseconds that have elapsed since a particular time.
	 * @param { Date | number } startAsDateOrMilliseconds
	 * @returns {number} The elapsed milliseconds.
	 */
	millisecondsSince(startAsDateOrMilliseconds) {
		ensure.signature(arguments, [[ Number, Date ]]);
		return this.now() - startAsDateOrMilliseconds;
	}

	/**
	 * The number of milliseconds until a particular time.
	 * @param { Date | number } endAsDateOrMilliseconds
	 * @returns {number} The milliseconds remaining.
	 */
	millisecondsUntil(endAsDateOrMilliseconds) {
		ensure.signature(arguments, [[ Number, Date ]]);
		return endAsDateOrMilliseconds - this.now();
	}

	/**
	 * A "dead man's switch." Calls `timeoutFn` if `aliveFn` hasn't been called in the last N milliseconds. Special note for nulled clocks: time doesn't pass automatically for nulled clocks, so this method won't time out unless one of the tick methods is called.
	 * @param {number} milliseconds The number of milliseconds to wait before calling `timeoutFn`.
	 * @param {() => void} timeoutFn The function to call if aliveFn() isn't called after `milliseconds`.
	 * @returns {{aliveFn: () => void, cancelFn: () => void}} Call aliveFn() to reset the timeout. Call cancelFn() to stop the timeout.
	 */
	keepAlive(milliseconds, timeoutFn) {
		ensure.signature(arguments, [ Number, Function ]);

		let cancelled = false;
		let handle;

		startTimer(this);

		return {
			aliveFn: () => {
				if (cancelled) return;
				this._globals.clearTimeout(handle);
				startTimer(this);
			},

			cancelFn: () => {
				cancelled = true;
				this._globals.clearTimeout(handle);
			},
		};

		function startTimer(self) {
			handle = self._globals.setTimeout(timeoutFn, milliseconds);
		}
	}

	/**
	 * Wait for a promise to resolve and return its value. If it hasn't completed in a certain amount of time, run a timeout function and return its value instead. Note that this DOES NOT CANCEL the original promise, which will still run to completion, although its return value will be discarded. (Promises cannot be cancelled.) Any cancellation mechanism you want to use must be programmed into the promise and timeout function.
	 * @template T
	 * @param {number} milliseconds the approximate number of milliseconds to wait
	 * @param {() => T | Promise<T>} fnAsync the promise to wait for
	 * @param {() => T | Promise<T>} timeoutFnAsync the function to run when the time is up
	 * @returns {Promise<T>} the promise's return value (if the promise resolves in time) or the timeout function's return value (if it doesn't)
	 */
	async timeoutAsync(milliseconds, fnAsync, timeoutFnAsync) {
		ensure.signature(arguments, [ Number, Function, Function ]);

		return await new Promise(async (resolve, reject) => {
			const timeoutToken = this._globals.setTimeout(async () => {
				try {
					const result = await timeoutFnAsync();
					resolve(result);
				}
				catch (err) {
					reject(err);
				}
			}, milliseconds);

			try {
				const result = await fnAsync();
				resolve(result);
			}
			catch (err) {
				reject(err);
			}
			finally {
				this._globals.clearTimeout(timeoutToken);
			}
		});
	}

	/**
	 * Advance a nulled clock forward in time. Throws an exception if the clock isn't nulled. (For
	 * non-nulled clocks, use waitAsync() instead.)
	 * @param {number} milliseconds the number of milliseconds to advance the clock
	 */
	async tickAsync(milliseconds) {
		ensure.signature(arguments, [ Number ]);
		await this._globals.tickAsync(milliseconds);
	}

	/**
	 * Advance a nulled clock forward in time until all timers expire. Throws an exception if the
	 * clock isn't nulled.
	 */
	async tickUntilTimersExpireAsync() {
		ensure.signature(arguments, []);
		await this._globals.tickUntilTimersExpireAsync();
	}

};


function nullGlobals({
	now = FAKE_START_TIME,
} = {}) {
	ensure.signature(arguments, [[ undefined, {
		now: [ undefined, Number, Date ],
	}]]);

	const fake = FakeTimers.createClock(now);

	return {
		Date: fake.Date,

		async tickAsync(milliseconds) {
			await fake.tickAsync(milliseconds);
		},

		async tickUntilTimersExpireAsync() {
			await fake.runAllAsync();
		},

		setTimeout(fn, milliseconds) {
			return fake.setTimeout(fn, milliseconds);
		},

		clearTimeout(handle) {
			return fake.clearTimeout(handle);
		},

		setInterval(fn, milliseconds) {
			return fake.setInterval(fn, milliseconds);
		},

		clearInterval(handle) {
			return fake.clearInterval(handle);
		},
	};

}
