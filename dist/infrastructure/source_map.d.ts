export interface NulledSourceMapConfiguration {
    [modulePath: string]: string[];
}
export declare class SourceMap {
    private readonly _module;
    static create(): SourceMap;
    static createNull(config?: NulledSourceMapConfiguration): SourceMap;
    constructor(_module: Module);
    getOriginalFilenames(pathToPreviouslyImportedModule: string): string[];
}
interface Module {
    findSourceMap(path: string): undefined | Payload;
}
interface Payload {
    payload: {
        sources: string[];
    };
}
export {};
