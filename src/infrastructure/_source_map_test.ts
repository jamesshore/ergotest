// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
import { assert, beforeEach, describe, it } from "../tests.js";
import fs from "node:fs/promises";
import { SourceMap } from "./source_map.js";
import * as module from "node:module";

export default describe(() => {

	let sourceFilePath: string;
	let sourceMapPath: string;
	let importCacheBuster = 0;

	beforeEach(async ({ getConfig }) => {
		const testDir = getConfig<string>("scratchDir");

		sourceFilePath = `${testDir}/my_file_${importCacheBuster}.js`;
		sourceMapPath = `${testDir}/my_file_${importCacheBuster}.map.js`;
		importCacheBuster++;
		await deleteTempFilesAsync(testDir);
	});

	describe("real behavior", () => {

		it("gets original filename from source map", async () => {
			const sourceFile = `//# sourceMappingURL=${sourceMapPath}`;
			const sourceMapFile = `{"version":3,"sources":["/my_original_file.ts"],"sourcesContent":[],"names":[],"mappings":""}`;

			await writeFilesAsync(sourceFile, sourceMapFile);
			const sourceMap = SourceMap.create();

			assert.equal(sourceMap.getOriginalFilenames(sourceFilePath), [ "/my_original_file.ts" ]);
		});

		it("returns an empty array if there is no source map", async () => {
			const sourceFile = `// no source map`;

			await writeFilesAsync(sourceFile, "");
			const sourceMap = SourceMap.create();

			assert.equal(sourceMap.getOriginalFilenames(sourceFilePath), []);
		});

		it("supports multiple original files", async () => {
			const sourceFile = `//# sourceMappingURL=${sourceMapPath}`;
			const sourceMapFile = `{"version":3,"sources":["/my_original_file.ts","/my_second_original.ts"],"sourcesContent":[],"names":[],"mappings":""}`;

			await writeFilesAsync(sourceFile, sourceMapFile);
			const sourceMap = SourceMap.create();

			assert.equal(
				sourceMap.getOriginalFilenames(sourceFilePath),
				[ "/my_original_file.ts", "/my_second_original.ts" ],
			);
		});

	});


	describe("nulled behavior", () => {

		it("doesn't look at actual module", async () => {
			const sourceFile = `//# sourceMappingURL=${sourceMapPath}`;
			const sourceMapFile = `{"version":3,"sources":["/my_original_file.ts"],"sourcesContent":[],"names":[],"mappings":""}`;

			await writeFilesAsync(sourceFile, sourceMapFile);
			const realSourceMap = SourceMap.create();
			const nulledSourceMap = SourceMap.createNull();

			assert.equal(realSourceMap.getOriginalFilenames(sourceFilePath), [ "/my_original_file.ts" ]);
			assert.equal(nulledSourceMap.getOriginalFilenames(sourceFilePath), []);
		});

		it("can be configured", () => {
			const sourceMap = SourceMap.createNull({
				"/file1.js": [ "original1.ts" ],
				"/file2.js": [ "original2a.ts", "original2b.ts" ],
			});

			assert.equal(sourceMap.getOriginalFilenames("/file1.js"), [ "original1.ts" ]);
			assert.equal(sourceMap.getOriginalFilenames("/file2.js"), [ "original2a.ts", "original2b.ts" ]);
			assert.equal(sourceMap.getOriginalFilenames("not_configured"), []);
		});

	});

	async function writeFilesAsync(sourceFile: string, sourceMapFile: string) {
		await fs.writeFile(sourceFilePath, sourceFile);
		await fs.writeFile(sourceMapPath, sourceMapFile);
		await import(sourceFilePath);
	}

});


async function deleteTempFilesAsync(testDir: string) {
	assert.isDefined(testDir);
	await fs.rm(testDir, { recursive: true, force: true });
	await fs.mkdir(testDir, { recursive: true });
}
