// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

// Automatically runs build when files change.

import Build from "./build.js";
import Colors from "infrastructure/colors.js";
import Shell from "infrastructure/shell.js";
import Paths from "./config/paths.js";
import FileSystem from "infrastructure/file_system.js";
import Clock from "infrastructure/clock.js";
import TaskCli from "tasks/task_cli.js";
import path from "node:path";

const watchColor = Colors.cyan;

const DEBOUNCE_MS = 100;

const args = process.argv.slice(2);
const clock = Clock.create();
const noOutputShell = Shell.createSilent();

let fileTreeChanged = false;
let restart = false;

runAsync();

async function runAsync() {
	const build = await Build.create();
	const fileSystem = FileSystem.create(Paths.rootDir, Paths.timestampsBuildDir);

	markTreeChangedWhenFilesAddedRemovedOrRenamed(fileSystem);  // runs in background
	const restartPromise = detectWhenBuildFilesChangeAsync(fileSystem);

	while (!restart) {
		const changePromise = Promise.race([
			debouncedWaitForChangeAsync(fileSystem),
			restartPromise,
		]);
		await runBuildAsync(build);
		await changePromise;
	}

	// watch.sh will detect that the process exited cleanly and restart it
	process.exit(0);
}

async function detectWhenBuildFilesChangeAsync(fileSystem) {
	await fileSystem.waitForChangeAsync(Paths.buildRestartGlobs);
	console.log(watchColor("*** Build files changed"));
	restart = true;
}

async function markTreeChangedWhenFilesAddedRemovedOrRenamed(fileSystem) {
	while (true) {
		const { changed } = await fileSystem.waitForChangeAsync(Paths.buildWatchGlobs);
		if (changed === FileSystem.CHANGED.TREE) fileTreeChanged = true;
	}
}

async function debouncedWaitForChangeAsync(fileSystem) {
	await clock.waitAsync(DEBOUNCE_MS);
	await fileSystem.waitForChangeAsync(Paths.buildWatchGlobs);
	console.log(watchColor("*** Change detected"));
}

async function runBuildAsync(build) {
	console.log(watchColor(`\n\n\n\n*** BUILD> ${args.join(" ")}`));
	const buildPromise = build.runCliAsync({ resetTreeCache: fileTreeChanged });
	fileTreeChanged = false;
	const buildResult = await buildPromise;

	if (buildResult === TaskCli.CLI_FAILURE) process.exit(1);

	// We don't 'await' this because we want it to run in the background.
	playBuildResultSoundAsync(buildResult);
}

async function playBuildResultSoundAsync(buildResult) {
	if (buildResult === null) {
		await playSoundAsync(Paths.successSound);
	}
	else if (buildResult === "lint") {
		await playSoundAsync(Paths.lintErrorSound);
	}
	else {
		await playSoundAsync(Paths.failSound);
	}
}

async function playSoundAsync(filename) {
	try {
		const file = path.resolve(import.meta.dirname, filename);
		if (process.platform === "darwin") {
			// MacOS has a built-in 'afplay' command
			await noOutputShell.execAsync("afplay", file, "--volume", "0.3");
		}
		else if(process.platform === 'win32') {
			// Use Powershell to create a Media.SoundPlayer .Net object. (Only works on .wav files.)
			await noOutputShell.execAsync(`powershell`, '-c', `(New-Object Media.SoundPlayer "${file}").PlaySync();`);
		}
		else {
			// aplay is part of the alsa-utils package
			await noOutputShell.execAsync("aplay", file);
		}
	}
	catch {
		// If audio player isn't found, or other error occurs, just ignore it
	}
}
