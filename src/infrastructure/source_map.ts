// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as module from "node:module";

export class SourceMap {

	static create() {
		return new SourceMap();
	}

	getOriginalFilenames(transpiledFilePath: string): string[] {
		const sourceMap = module.findSourceMap(transpiledFilePath);
		if (sourceMap === undefined) return [];

		return sourceMap.payload.sources.map(filename => {
			if(filename.substring(0, 7) !== "file://") return filename; // this line not tested
			else return filename.slice(7);
		});
	}

}