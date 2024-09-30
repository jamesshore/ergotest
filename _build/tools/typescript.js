// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const swc = require("@swc/core");
const Colors = require("infrastructure/colors");
const pathLib = require("node:path");
const FileSystem = require("infrastructure/file_system");
const ensure = require("util/ensure");
const TaskError = require("tasks/task_error");
const Reporter = require("tasks/reporter");
const Shell = require("infrastructure/shell");

module.exports = class TypeScript {

	static create(fileSystem) {
		ensure.signature(arguments, [ FileSystem ]);

		return new TypeScript(fileSystem, Shell.create());
	}

	constructor(fileSystem, shell) {
		this._fileSystem = fileSystem;
		this._shell = shell;
	}

	async compileAsync({
		description,
		files,
		sourceDir,
		outputDir,
		config,
		reporter,
	}) {
		ensure.signature(arguments, [{
			description: String,
			files: Array,
			sourceDir: String,
			outputDir: String,
			config: Object,
			reporter: Reporter,
		}]);

		await reporter.quietStartAsync(`Compiling ${description}`, async (report) => {
			const successes = await Promise.all(files.map(async (sourceFile) => {
				const compiledFile = outputFilename(sourceFile, ".js", sourceDir, outputDir);
				const sourceMapFile = outputFilename(sourceFile, ".js.map", sourceDir, outputDir);

				const isModified = await this._fileSystem.compareFileModificationTimesAsync(sourceFile, compiledFile) > 0;
				if (!isModified) return true;

				try {
					report.started();
					const { code, map } = await swc.transformFile(sourceFile, config);
					const sourceMapLink = `\n//# sourceMappingURL=${sourceMapFile}\n`;

					await this._fileSystem.writeTextFileAsync(compiledFile, code + sourceMapLink);
					await this._fileSystem.writeTextFileAsync(sourceMapFile, map);

					report.progress();
					return true;
				}
				catch(err) {
					const failMessage = Colors.brightWhite.underline(`${pathLib.basename(sourceFile)} failed:`);
					process.stdout.write(`\n\n${failMessage}${err.message}\n`);
					return false;
				}
			}));

			const failed = successes.some(entry => entry === false);
			if (failed) throw new TaskError("Compile failed");
		});
	}

	async typecheckAsync({
		description,
		tscBinary,
		typescriptConfigFile,
		reporter,
	}) {
		ensure.signature(arguments, [{
			description: String,
			tscBinary: String,
			typescriptConfigFile: String,
			reporter: Reporter,
		}]);

		await reporter.startAsync(`Type-checking ${description}`, async (report) => {
			const { code } = await this._shell.execAsync(tscBinary, "-p", typescriptConfigFile);
			if (code !== 0) throw new TaskError("Type check failed");
		});
	}

};

function outputFilename(filename, extension, sourceDir, outputDir) {
	const parsedFilename = pathLib.parse(filename);
	const jsFilename = `${parsedFilename.dir}/${parsedFilename.name}${extension}`;
	return `${outputDir}/${pathLib.relative(sourceDir, jsFilename)}`;
}
