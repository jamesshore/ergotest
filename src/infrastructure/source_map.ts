// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as module from "node:module";

export interface NulledSourceMapConfiguration {
	[modulePath: string]: string[]
}

export class SourceMap {

	static create() {
		return new SourceMap(module);
	}

	static createNull(config?: NulledSourceMapConfiguration) {
		return new SourceMap(new ModuleStub(config));
	}

	constructor(private readonly _module: Module) {
	}

	getOriginalFilenames(pathToPreviouslyImportedModule: string): string[] {
		const sourceMap = this._module.findSourceMap(pathToPreviouslyImportedModule);
		if (sourceMap === undefined) return [];

		return sourceMap.payload.sources.map(filename => {
			if(filename.substring(0, 7) !== "file://") return filename; // this line not tested
			else return filename.slice(7);
		});
	}

}

interface Module {
	findSourceMap(path: string): undefined | Payload,
}

interface Payload {
	payload: {
		sources: string[],
	},
}

class ModuleStub implements Module {

	constructor(private readonly _config: NulledSourceMapConfiguration = {}) {
	}

	findSourceMap(path: string): Payload {
		const sources = this._config[path] ?? [];

		return {
			payload: {
				sources,
			}
		};
	}

}

