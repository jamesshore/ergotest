// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import { ItFn, ItOptions } from "../test_api.js";

export class BeforeAfter {
	private readonly _name: string[];
	public options: ItOptions;
	public fnAsync: ItFn;

	static create({
		name,
		options = {},
		fnAsync
	}: {
		name: string[],
		options?: ItOptions,
		fnAsync: ItFn,
	}) {
		return new BeforeAfter(name, options, fnAsync);
	}

	constructor(name: string[], options: ItOptions, fnAsync: ItFn) {
		this._name = name;
		this.options = options;
		this.fnAsync = fnAsync;
	}

	get name() {
		return this._name;
	}
}