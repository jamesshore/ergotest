// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../../util/ensure.js";
import EventEmitter from "node:events";

/** A utility class for infrastructure wrappers to use track output */
module.exports = class OutputTracker<T> {

	static create<T>(emitter: EventEmitter, event: string): OutputTracker<T> {
		ensure.signature(arguments, [ EventEmitter, String ]);
		return new OutputTracker(emitter, event);
	}

	private readonly _emitter: EventEmitter;
	private readonly _event: string;
	private readonly _data: T[];
	private readonly _trackerFn: (data: T) => void;

	constructor(emitter: EventEmitter, event: string) {
		this._emitter = emitter;
		this._event = event;
		this._data = [];

		this._trackerFn = (text) => this._data.push(text);
		this._emitter.on(this._event, this._trackerFn);
	}

	get data() {
		return this._data;
	}

	consume() {
		const result = [ ...this._data ];
		this._data.length = 0;
		return result;
	}

	off() {
		this.consume();
		this._emitter.off(this._event, this._trackerFn);
	}

};