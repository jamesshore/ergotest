import { TestMarkValue } from "../results/test_result.js";
import { TestSuite } from "./test_suite.js";
import { DescribeFn, DescribeOptions, ItFn, ItOptions } from "./test_api.js";
export declare class ApiContext {
    #private;
    private readonly _context;
    describe(optionalName: string | DescribeOptions | DescribeFn | undefined, optionalOptions: DescribeOptions | DescribeFn | undefined, optionalFn: DescribeFn | undefined, mark: TestMarkValue): TestSuite;
    it(name: string, optionalOptions: ItOptions | ItFn | undefined, possibleFnAsync: ItFn | undefined, mark: TestMarkValue): void;
    beforeAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn): void;
    afterAll(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn): void;
    beforeEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn): void;
    afterEach(optionalOptions: ItOptions | ItFn, possibleFnAsync?: ItFn): void;
}
