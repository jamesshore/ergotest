// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const ensure = require("util/ensure");
const Tasks = require("tasks/tasks");
const TaskCli = require("tasks/task_cli");
const Reporter = require("tasks/reporter");
const FileSystem = require("infrastructure/file_system");
const Version = require("./tools/version");
const Lint = require("./tools/lint");
const Tests = require("./tools/tests");
const TypeScript = require("./tools/typescript");
const Paths = require("./config/paths");
const testConfig = require("./config/tests.conf");
const lintJavascriptConfig = require("./config/eslint.javascript.config");
const lintTypescriptConfig = require("./config/eslint.typescript.config");
const swcConfig = require("./config/swc.conf");
const path = require("node:path");

module.exports = class Build {

	static create() {
		ensure.signature(arguments, []);

		return new Build();
	}

	constructor() {
		this._fileSystem = FileSystem.create(Paths.rootDir, Paths.timestampsBuildDir);
		this._reporter = Reporter.create();
		this._paths = undefined;
		this._tasks = undefined;
	}

	async runAsync({ resetTreeCache = false } = {}) {
		ensure.signature(arguments, [[ undefined, {
			resetTreeCache: [ undefined, Boolean ],
		}]]);

		if (this._paths === undefined || resetTreeCache) {
			this._paths = await scanFileTreeAsync(this._fileSystem, this._reporter);
		}
		if (this._tasks === undefined) {
			this._tasks = defineTasks(this);
			this._tasks.setDescriptions({
				default: "Clean and rebuild",
				clean: "Erase all generated and incremental files",
				quick: "Perform an incremental build",
				version: "Check Node.js version",
				lint: "Lint JavaScript code (incremental)",
				unittest: "Run unit tests (incremental)",
				compile: "Compile TypeScript (incremental)",
				typecheck: "Type-check TypeScript",
			});
		}

		return await TaskCli.create().runAsync(this._tasks, "BUILD OK", "BUILD FAILURE");
	}

};


async function scanFileTreeAsync(fileSystem, reporter) {
	return await reporter.startAsync("Scanning file tree", async () => {
		const fileTree = await fileSystem.readFileTreeAsync(Paths.rootDir, Paths.universalGlobsToExclude);
		return Paths.create(fileTree);
	});
}

function defineTasks(self) {
	const tasks = Tasks.create({ fileSystem: self._fileSystem, incrementalDir: self._paths.tasksDir });
	const version = Version.create(self._fileSystem);
	const lint = Lint.create(self._fileSystem);
	const tests = Tests.create(self._fileSystem, Paths.dependencyTreeGlobsToExclude);
	const typescript = TypeScript.create(self._fileSystem);

	tasks.defineTask("default", async() => {
		await tasks.runTasksAsync([ "clean", "quick", "typecheck" ]);
	});

	tasks.defineTask("clean", async () => {
		await self._reporter.startAsync("Deleting generated files", async () => {
			await self._fileSystem.deleteAsync(self._paths.generatedDir);
		});
	});

	tasks.defineTask("quick", async () => {
		await tasks.runTasksAsync([ "version", "lint", "unittest" ]);
	});

	tasks.defineTask("version", async () => {
		await version.checkAsync({
			packageJson: Paths.packageJson,
			reporter: self._reporter,
		});
	});

	tasks.defineTask("lint", async () => {
		await lint.validateAsync({
			description: "JavaScript",
			files: self._paths.lintJavascriptFiles(),
			config: lintJavascriptConfig,
			reporter: self._reporter,
		});

		await lint.validateAsync({
			description: "TypeScript",
			files: self._paths.lintTypescriptFiles(),
			config: lintTypescriptConfig,
			reporter: self._reporter,
		});
	});

	tasks.defineTask("unittest", async () => {
		await tests.runAsync({
			description: "JavaScript tests",
			files: self._paths.buildTestFiles(),
			config: testConfig,
			reporter: self._reporter,
		});

		await tasks.runTasksAsync([ "compile" ]);

		const srcTestFiles = self._paths.srcTestFiles().map(file => {
			const relativeFile = path.relative(Paths.typescriptSrcDir, file);
			const relocatedFile = path.resolve(Paths.typescriptTargetDir, relativeFile);
			if (file.endsWith(".ts")) {
				return `${path.dirname(relocatedFile)}/${path.basename(relocatedFile, "ts")}js`;
			}
			else {
				return relocatedFile;
			}
		});

		await tests.runAsync({
			description: "TypeScript tests",
			files: srcTestFiles,
			config: testConfig,
			reporter: self._reporter,
		});
	});

	tasks.defineTask("compile", async () => {
		await self._reporter.quietStartAsync("Synchronizing source tree", async (report) => {
			function javascriptToTypescript(sourceFile) {
				if (!sourceFile.endsWith(".ts")) return sourceFile;

				const noExtension = `${path.dirname(sourceFile)}/${path.basename(sourceFile, "ts")}`;
				return [ `${noExtension}js`, `${noExtension}js.map` ];
			}

			const { added, removed, changed } = await self._fileSystem.compareDirectoriesAsync(
				Paths.typescriptSrcDir, Paths.typescriptTargetDir, javascriptToTypescript,
			);

			const filesToCopy = [ ...added, ...changed ];
			const filesToDelete = removed;
			if (filesToCopy.length + filesToDelete.length > 0) report.started();

			const copyPromises = filesToCopy.map(async ({ source, target }) => {
				if (source.endsWith(".ts")) return; // TypeScript files will be copied by the compiler

				await self._fileSystem.copyAsync(source, target);
				report.progress();
			});
			const deletePromises = filesToDelete.map(async ({ source, target }) => {
				await self._fileSystem.deleteAsync(target);
				report.progress();
			});

			await Promise.all([ ...copyPromises, ...deletePromises ]);
		});

		await typescript.compileAsync({
			description: "TypeScript",
			files: self._paths.typescriptFiles(),
			sourceDir: Paths.typescriptSrcDir,
			outputDir: Paths.typescriptTargetDir,
			config: swcConfig,
			reporter: self._reporter,
		});
	});

	tasks.defineTask("typecheck", async () => {
		await typescript.typecheckAsync({
			description: "TypeScript",
			tscBinary: Paths.tscBinary,
			typescriptConfigFile: Paths.typescriptConfigFile,
			reporter: self._reporter,
		});
	});

	return tasks;
}
