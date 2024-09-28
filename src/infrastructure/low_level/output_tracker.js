// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const ensure = require("../../util/ensure");
const EventEmitter = require("node:events");

/** A utility class for infrastructure wrappers to use track output */
module.exports = class OutputTracker {

	static create(emitter, event) {
		ensure.signature(arguments, [ EventEmitter, String ]);
		return new OutputTracker(emitter, event);
	}

	constructor(emitter, event) {
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