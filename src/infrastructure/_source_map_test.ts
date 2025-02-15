// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, beforeEach, describe, it } from "../tests.js";
import fs from "node:fs/promises";
import { SourceMap } from "./source_map.js";
import * as module from "node:module";

export default describe(() => {

	describe("real behavior", () => {
		let nonce = 0;
		let SOURCE_FILE_PATH: string;
		let SOURCE_MAP_PATH: string;

		beforeEach(async ({ getConfig }) => {
			const testDir = getConfig<string>("scratchDir");

			SOURCE_FILE_PATH = `${testDir}/my_file_${nonce}.js`;
			SOURCE_MAP_PATH = `${testDir}/my_file_${nonce}.map.js`;
			nonce++;
			await deleteTempFilesAsync(testDir);
		});

		it("gets original filename from source map", async () => {
			const sourceFile = `//# sourceMappingURL=${SOURCE_MAP_PATH}`;
			const sourceMapFile = `{"version":3,"sources":["/my_original_file.ts"],"sourcesContent":[],"names":[],"mappings":""}`;

			await writeFilesAsync(sourceFile, sourceMapFile);
			const sourceMap = SourceMap.create();

			assert.equal(sourceMap.getOriginalFilenames(SOURCE_FILE_PATH), [ "/my_original_file.ts" ]);
		});

		it("returns an empty array if there is no source map", async () => {
			const sourceFile = `// no source map`;

			await writeFilesAsync(sourceFile, "");
			const sourceMap = SourceMap.create();

			assert.equal(sourceMap.getOriginalFilenames(SOURCE_FILE_PATH), []);
		});

		it("supports multiple original files", async () => {
			const sourceFile = `//# sourceMappingURL=${SOURCE_MAP_PATH}`;
			const sourceMapFile = `{"version":3,"sources":["/my_original_file.ts","/my_second_original.ts"],"sourcesContent":[],"names":[],"mappings":""}`;

			await writeFilesAsync(sourceFile, sourceMapFile);
			const sourceMap = SourceMap.create();

			assert.equal(
				sourceMap.getOriginalFilenames(SOURCE_FILE_PATH),
				[ "/my_original_file.ts", "/my_second_original.ts" ]
			);
		});

		async function writeFilesAsync(sourceFile: string, sourceMapFile: string) {
			await fs.writeFile(SOURCE_FILE_PATH, sourceFile);
			await fs.writeFile(SOURCE_MAP_PATH, sourceMapFile);
			await import(SOURCE_FILE_PATH);
		}

	});


	describe.skip("nulled behavior", () => {

	});

});


async function deleteTempFilesAsync(testDir: string) {
	assert.isDefined(testDir);
	await fs.rm(testDir, { recursive: true, force: true });
	await fs.mkdir(testDir, { recursive: true });
}
