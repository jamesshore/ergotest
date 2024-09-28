// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const swc = require("@swc/core");
const Colors = require("infrastructure/colors");
const pathLib = require("node:path");
const FileSystem = require("infrastructure/file_system");
const ensure = require("util/ensure");
const TaskError = require("tasks/task_error");
const Reporter = require("tasks/reporter");

const COMPILE_RESULT = {
	SUCCESS: "success",
	FAIL: "fail",
};

module.exports = class TypeScript {

	static create(fileSystem) {
		ensure.signature(arguments, [ FileSystem ]);

		return new TypeScript(fileSystem);
	}

	constructor(fileSystem) {
		this._fileSystem = fileSystem;
	}

	async compileAsync({
		description,
		files,
		rootDir,
		outputDir,
		config,
		reporter,
	}) {
		ensure.signature(arguments, [{
			description: String,
			files: Array,
			rootDir: String,
			outputDir: String,
			config: Object,
			reporter: Reporter,
		}]);

		await reporter.quietStartAsync(`Compiling ${description}`, async (report) => {
			const compileResults = await Promise.all(files.map(async (sourceFile) => {
				const compiledFile = compilerDependencyName(sourceFile, ".js", rootDir, outputDir);
				const sourceMapFile = compilerDependencyName(sourceFile, ".js.map", rootDir, outputDir);

				const isModified = await this._fileSystem.compareFileModificationTimesAsync(sourceFile, compiledFile) > 0;
				if (!isModified) return { failed: false };

				try {
					const { code, map } = await swc.transformFile(sourceFile, config);
					const sourceMapLink = `\n//# sourceMappingURL=${sourceMapFile}\n`;

					await this._fileSystem.writeTextFileAsync(compiledFile, code + sourceMapLink);
					await this._fileSystem.writeTextFileAsync(sourceMapFile, map);

					report.progress();
					return COMPILE_RESULT.SUCCESS;
				}
				catch(err) {
					const failMessage = Colors.brightWhite.underline(`${pathLib.basename(sourceFile)} failed:`);
					process.stdout.write(`\n\n${failMessage}${err.message}\n`);
					return COMPILE_RESULT.FAIL;
				}
			}));

			const failed = compileResults.some(entry => entry === COMPILE_RESULT.FAIL);
			if (failed) throw new TaskError("Compile failed");
		});
	}

};

function compilerDependencyName(filename, extension, rootDir, outputDir) {
	const parsedFilename = pathLib.parse(filename);
	const jsFilename = `${parsedFilename.dir}/${parsedFilename.name}${extension}`;
	return `${outputDir}/${pathLib.relative(rootDir, jsFilename)}`;
}
