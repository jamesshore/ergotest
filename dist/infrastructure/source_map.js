// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import * as module from "node:module";
export class SourceMap {
    _module;
    static create() {
        return new SourceMap(module);
    }
    static createNull(config) {
        return new SourceMap(new ModuleStub(config));
    }
    constructor(_module){
        this._module = _module;
    }
    getOriginalFilenames(pathToPreviouslyImportedModule) {
        const sourceMap = this._module.findSourceMap(pathToPreviouslyImportedModule);
        if (sourceMap === undefined) return [];
        return sourceMap.payload.sources.map((filename)=>{
            if (filename.substring(0, 7) !== "file://") return filename; // this line not tested
            else return filename.slice(7);
        });
    }
}
class ModuleStub {
    _config;
    constructor(_config = {}){
        this._config = _config;
    }
    findSourceMap(path) {
        const sources = this._config[path] ?? [];
        return {
            payload: {
                sources
            }
        };
    }
}

//# sourceMappingURL=/Users/jshore/Documents/Projects/ergotest/generated/src/infrastructure/source_map.js.map
