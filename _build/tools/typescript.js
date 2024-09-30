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
const path = require("node:path");
const Paths = require("../config/paths");

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

		const typescriptToCompile = await this.#synchronizeSourceTreeToTarget(reporter, description, sourceDir, outputDir);
		await this.#runCompiler(reporter, description, typescriptToCompile, sourceDir, outputDir, config);
	}

	mapTsToJs({ files, sourceDir, outputDir }) {
		ensure.signature(arguments, [{ files: Array, sourceDir: String, outputDir: String }]);

		return files.map(file => {
			const relativeFile = path.relative(sourceDir, file);
			const relocatedFile = path.resolve(outputDir, relativeFile);
			if (file.endsWith(".ts")) {
				return `${path.dirname(relocatedFile)}/${path.basename(relocatedFile, "ts")}js`;
			}
			else {
				return relocatedFile;
			}
		});
	}

	async #synchronizeSourceTreeToTarget(reporter, description, sourceDir, outputDir) {
		return await reporter.quietStartAsync(`Synchronizing ${description}`, async (report) => {
			const tsToJsFn = (sourceFile) => {
				if (!sourceFile.endsWith(".ts")) return sourceFile;

				const noExtension = `${path.dirname(sourceFile)}/${path.basename(sourceFile, "ts")}`;
				return [ `${noExtension}js`, `${noExtension}js.map` ];
			};

			const { added, removed, changed } = await this._fileSystem.compareDirectoriesAsync(
				sourceDir, outputDir, tsToJsFn,
			);

			const filesToCopy = [ ...added, ...changed ];
			const filesToDelete = removed;

			const typescriptToCompile = new Set();
			const copyPromises = filesToCopy.map(async ({ source, target }) => {
				if (source.endsWith(".ts")) {
					typescriptToCompile.add(source);
				}
				else {
					await this._fileSystem.copyAsync(source, target);
					report.progress({ debug: `\nCopy: ${source} --> ${target}`});
				}
			});
			const deletePromises = filesToDelete.map(async ({ source, target }) => {
				await this._fileSystem.deleteAsync(target);
				report.progress({ debug: `\nDelete: ${target}`});
			});

			await Promise.all([ ...copyPromises, ...deletePromises ]);

			return [ ...typescriptToCompile ];
		});
	}

	async #runCompiler(reporter, description, files, sourceDir, outputDir, config) {
		await reporter.quietStartAsync(`Compiling ${description}`, async (report) => {
			const successes = await Promise.all(files.map(async (sourceFile) => {
				const compiledFile = outputFilename(sourceFile, ".js", sourceDir, outputDir);
				const sourceMapFile = outputFilename(sourceFile, ".js.map", sourceDir, outputDir);

				try {
					report.started();
					const { code, map } = await swc.transformFile(sourceFile, config);
					const sourceMapLink = `\n//# sourceMappingURL=${sourceMapFile}\n`;

					await this._fileSystem.writeTextFileAsync(compiledFile, code + sourceMapLink);
					await this._fileSystem.writeTextFileAsync(sourceMapFile, map);

					report.progress({ debug: `\nCompile: ${sourceFile} --> ${compiledFile} -+- ${sourceMapFile}`});
					return true;
				}
				catch(err) {
					report.progress({
						text: Colors.brightRed.inverse("X"),
						debug: `\nCompile (FAILED): ${sourceFile} --> ${compiledFile} -+- ${sourceMapFile}`
					});
					const failMessage = Colors.brightWhite.underline(`${sourceFile}:\n`);
					report.footer(`\n${failMessage}${err.message}\n`);
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
