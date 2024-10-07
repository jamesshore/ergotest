// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

import * as ensure from "util/ensure.js";
import Tasks from "tasks/tasks.mjs";
import TaskCli from "tasks/task_cli.mjs";
import Reporter from "tasks/reporter.mjs";
import FileSystem from "infrastructure/file_system.mjs";
import Version from "./tools/version.mjs";
import Lint from "./tools/lint.mjs";
import Tests from "./tools/tests.mjs";
import TypeScript from "./tools/typescript.mjs";
import Paths from "./config/paths.mjs";
import testConfig from "./config/tests.conf.mjs";
import lintJavascriptConfig from "./config/eslint.javascript.config.mjs";
import lintTypescriptConfig from "./config/eslint.typescript.config.mjs";
import swcConfig from "./config/swc.conf.mjs";

export default class Build {

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
				clean: "Erase all generated files (resets incremental build)",
				quick: "Perform an incremental build",
				version: "Check Node.js version",
				lint: "Lint JavaScript code (incremental)",
				unittest: "Run unit tests (incremental)",
				compile: "Compile TypeScript (incremental)",
				typecheck: "Type-check TypeScript and create declaration files",
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

		await tests.runAsync({
			description: "TypeScript tests",
			files: typescript.mapTsToJs({
				files: self._paths.srcTestFiles(),
				sourceDir: Paths.typescriptSrcDir,
				outputDir: Paths.typescriptTargetDir,
			}),
			config: testConfig,
			reporter: self._reporter,
		});
	});

	tasks.defineTask("compile", async () => {
		await typescript.compileAsync({
			description: "TypeScript tree",
			files: self._paths.typescriptFiles(),
			sourceDir: Paths.typescriptSrcDir,
			outputDir: Paths.typescriptTargetDir,
			config: swcConfig,
			reporter: self._reporter,
		});
	});

	tasks.defineTask("typecheck", async () => {
		await typescript.typecheckAndEmitDeclarationFilesAsync({
			description: "TypeScript",
			tscBinary: Paths.tscBinary,
			typescriptConfigFile: Paths.typescriptConfigFile,
			outputDir: Paths.typescriptTargetDir,
			reporter: self._reporter,
		});
	});

	return tasks;
}
