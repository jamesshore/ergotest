// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const ensure = require("../util/ensure");
const fs = require("node:fs/promises");
const path = require("node:path");
const OutputTracker = require("./low_level/output_tracker");
const EventEmitter = require("node:events");
const FileTree = require("./file_tree");
const { minimatch } = require("minimatch");

const EVENT = "read";
const TRACK_ACTION = {
	READ: "read",
	WRITE: "write",
	DELETE: "delete",
	COPY: "copy",
	MODULE_RESOLUTION: "module",
};
const CHANGED = {
	FILE: "change",   // These values defined by fs.watch()--do not change them
	TREE: "rename",
};

/** Wrapper for the file system. */
module.exports = class FileSystem {

	/**
	 * Enum used by {@FileSystem#waitForChangeAsync}.
	 * @returns {{TREE: string, FILE: string}} `TREE` represents changes to the file tree (add, remove, or delete).
	 *   `FILE` represents changes to an existing file. Note that, depending on the operating system, these distinctions
	 *   are somewhat unreliable. On MacOS, when a file is created or renamed, additional changes are considered to be
	 *   `TREE` changes for some amount of time afterwards.
	 */
	static get CHANGED() {
		return CHANGED;
	}

	/**
	 * Enum used by {@FileSystem#track}.
	 */
	static get TRACK_ACTION() {
		return TRACK_ACTION;
	}

	/**
	 * Factory method. Create the wrapper.
	 * @param {string} rootDir The top-most directory to operate on. Attempts to operate on files outside this directory
	 *   (or its subdirectories) will cause an exception. WARNING: This is a convenience feature, not a security measure.
	 *   Do not use it to prevent bad actors from accessing sensitive files.
	 * @param {string} timestampDir The directory to store timestamp files (see {@link
	 *   FileSystem#writeTimestampFileAsync}). It's usually best for this to be a temporary directory. Must be inside
	 *   `rootDir`.
	 * @returns {FileSystem} The wrapper.
	 */
	static create(rootDir, timestampDir) {
		ensure.signature(arguments, [ String, String ]);

		return new FileSystem(rootDir, timestampDir, fs, require);
	}

	/**
	 * Factory method. Create a stubbed file system with pre-configured data. It discards writes and other changes.
	 * @param {Object.<string, {content?: string, modified?: number}>} [files] The files in the stubbed file system. The
	 *   key is the filename and the value is an object. The object may contain two optional values: `content`, which
	 *   specifies the file contents; and `modified` which specifies the date that the file was last modified, as a
	 *   numeric timestamp).
	 * @param [options] Additional options for this filesystem.
	 * @param {string} [options.rootDir] The top-most directory for the file system. Attempts to operate on files outside
	 *   this directory (or its subdirectories) will cause an exception. Defaults to `/`.
	 * @param {string} [options.timestampDir] The directory to store timestamp files (see
	 *   {@link FileSystem#writeTimestampFileAsync}). It's usually best for this to be a temporary directory. Must be
	 *   inside `rootDir`.
	 * @returns {FileSystem} The stubbed file system.
	 */
	static createNull(files = {}, {
		rootDir = "/",
		timestampDir = "/nulled_timestamp_dir",
	} = {}) {
		ensure.signature(arguments, [[ undefined, Object ], [ undefined, {
			rootDir: [ undefined, String ],
			timestampDir: [ undefined, String ],
		}]]);
		Object.entries(files).forEach(([ filename, configuration ]) => {
			ensure.that(path.isAbsolute(filename), `Nulled FileSystem must use absolute paths, but '${filename}' is relative`);
			ensure.type(configuration, {
				content: [ undefined, String ],
				modified: [ undefined, Number, Date ],
			}, `file '${filename}'`);
		});

		return new FileSystem(rootDir, timestampDir, new FsStub(files), new RequireStub(files));
	}

	/** For internal use only. (Use a factory method instead.) */
	constructor(rootDir, timestampDir, fs, require) {
		this._rootDir = rootDir;
		this._timestampDir = timestampDir;
		this._fs = fs;
		this._require = require;
		this._emitter = new EventEmitter();
	}

	/**
	 * Track file operations.
	 * @returns {OutputTracker} The output tracker.
	 */
	track() {
		return new OutputTracker(this._emitter, EVENT);
	}

	/**
	 * Read the contents of a file as text.
	 * @param {string} filename The path to the file.
	 * @returns {Promise<string>} The contents of the file.
	 */
	async readTextFileAsync(filename) {
		ensure.signature(arguments, [ String ]);
		ensureValidPath(filename, this._rootDir);

		const content = await this._fs.readFile(filename, { encoding: "utf8" });
		this._emitter.emit(EVENT, { action: TRACK_ACTION.READ, filename });
		return content;
	}

	/**
	 * Create or overwrite a file. Creates subdirectories as needed.
	 * @param {string} filename The path to the file.
	 * @param {string} content The contents of the file.
	 */
	async writeTextFileAsync(filename, content) {
		ensure.signature(arguments, [ String, String ]);
		ensureValidPath(filename, this._rootDir);

		const dir = path.dirname(filename);
		await this._fs.mkdir(dir, { recursive: true });
		await this._fs.writeFile(filename, content, { encoding: "utf8" });

		this._emitter.emit(EVENT, { action: TRACK_ACTION.WRITE, filename, content });
	}

	/**
	 * Delete a file or directory. Recursively deletes the contents of directories.
	 * @param {string} fileOrDirectory The path to the file or directory.
	 */
	async deleteAsync(fileOrDirectory) {
		ensure.signature(arguments, [ String ]);
		ensureValidPath(fileOrDirectory, this._rootDir);

		await this._fs.rm(fileOrDirectory, { recursive: true, force: true });
		this._emitter.emit(EVENT, { action: TRACK_ACTION.DELETE, filename: fileOrDirectory });
	}

	/**
	 * Recursively copy a directory or file. Creates subdirectories as needed. Overwrites existing files and directories.
	 * @param {string} fileOrDirectory The path to the file or directory.
	 * @param {string} destination The name of the new file or directory.
	 */
	async copyAsync(fileOrDirectory, destination) {
		ensure.signature(arguments, [ String, String ]);
		ensureValidPath(fileOrDirectory, this._rootDir);
		ensureValidPath(destination, this._rootDir);

		await this._fs.cp(fileOrDirectory, destination, { recursive: true });
		this._emitter.emit(EVENT, { action: TRACK_ACTION.COPY, src: fileOrDirectory, dest: destination });
	}

	/**
	 * Wait until a change occurs somewhere in this file system (which starts at `rootDir`—see {@link
	 * FileSystem.create}). When a change occurs, return an object that explains what changed and how.
	 * @param {string | array} [globsToCheck="**"] Only wait for changes in files that match this list of file globs.
	 *   Defaults to all files.
	 * @returns {Promise<{filename: string, changed: FileSystem.CHANGED}>} The name of the file that changed and whether
	 *   it represents a change to an existing file or a change to the file tree (add, rename, delete). Note that,
	 *   depending on the operating system, these distinctions are somewhat unreliable. On MacOS, when a file is created
	 *   or renamed, additional changes are considered to be `TREE` changes for some amount of time afterwards.
	 */
	async waitForChangeAsync(globsToCheck = [ "**" ]) {
		ensure.signature(arguments, [[ undefined, String, Array ]]);
		if (!Array.isArray(globsToCheck)) globsToCheck = [ globsToCheck ];

		const aborter = new AbortController();
		const watcher = this._fs.watch(this._rootDir, { signal: aborter.signal, recursive: true });

		let result;
		try {
			for await (const event of watcher) {
				const filename = path.resolve(this._rootDir, event.filename);
				if (globsToCheck.some(glob => minimatch(filename, glob))) {
					result = { changed: event.eventType, filename };
					aborter.abort();
				}
			}
		}
		catch (err) {
			if (err.code !== "ABORT_ERR") throw err;
		}

		return result;
	}

	/**
	 * Find all the files in a directory and its subdirectories, except for directories and files that match
	 * `globsToExclude`.
	 * @param {string} directoryName The directory to look within.
	 * @param {string | string[]} [globsToExclude] Don't include files that match these file globs.
	 * @returns {Promise<FileTree>} An object that allows further inspection of the files.
	 */
	async readFileTreeAsync(directoryName, globsToExclude = []) {
		ensure.signature(arguments, [ String, [ undefined, String, Array ] ]);
		ensureValidPath(directoryName, this._rootDir);
		if (!Array.isArray(globsToExclude)) globsToExclude = [ globsToExclude ];

		const entities = await this._fs.readdir(directoryName, { recursive: true, withFileTypes: true });

		const files = entities.filter(entity => entity.isFile());
		const absolutePaths = files.map(file => path.resolve(file.parentPath, file.name));

		return FileTree.create(absolutePaths, globsToExclude);
	}

	/**
	 * Determine when a file was modified (its `mtime`).
	 * @param {string} filename The file to check.
	 * @returns {Promise<number>} The timestamp of when the file was last modified.
	 */
	async getFileModificationTimeAsync(filename) {
		ensure.signature(arguments, [ String ]);
		ensureValidPath(filename, this._rootDir);

		const { mtime } = await this._fs.stat(filename);
		return mtime;
	}

	/**
	 * Determine the path to a Node module, using Node's module resolution algorithm.
	 * @param {string} baseDir The starting directory for the search.
	 * @param {string} module The relative path to the Node module.
	 * @returns {Promise<string>} The absolute path to the Node module.
	 */
	async resolveModulePathAsync(baseDir, module) {
		ensure.signature(arguments, [ String, String ]);

		// We force this method to be async as a future-proofing technique. Although require.resolve is synchronous,
		// the EcmaScript Modules equivalent, import.meta.resolve, is asynchronous.
		return await new Promise((resolvePromise, rejectPromise) => {
			setImmediate(() => {
				try {
					const resolvedFilename = this._require.resolve(module, { paths: [ baseDir ] });
					this._emitter.emit(EVENT, { action: TRACK_ACTION.MODULE_RESOLUTION, resolvedFilename });
					resolvePromise(resolvedFilename);
				}
				catch (err) {
					rejectPromise(err);
				}
			});
		});
	}

	/**
	 * Determine the path to a 'timestamp file', a special file useful for build automation. It's a file that records the
	 * last time an operation was performed on the original file. The name of a timestamp file is the same as the
	 * original file, except that it's located in the `timestampDir` (see {@link FileSystem.create}) and has an
	 * additional extension.
	 * @param originalFile The file this timestamp file is for.
	 * @param timestampExtension The extension to add to the timestamp file.
	 * @returns {string} The path to the timestamp file.
	 */
	timestampFileFor(originalFile, timestampExtension) {
		return timestampFilename(originalFile, timestampExtension, this._rootDir, this._timestampDir);
	}

	/**
	 * Create a 'timestamp file', a special file useful for build automation. It's a file that records the last time an
	 * operation was performed on the original file. The name of a timestamp file is the same as the original file,
	 * except that it's located in the `timestampDir` (see {@link FileSystem.create}) and has an additional extension.
	 * The contents are unspecified; only the modification time matters.
	 * @param originalFile The file to create a timestamp file for.
	 * @param timestampExtension The extension to add to the timestamp file.
	 */
	async writeTimestampFileAsync(originalFile, timestampExtension) {
		ensure.signature(arguments, [ String, String ]);
		ensureValidPath(originalFile, this._rootDir);

		const file = timestampFilename(originalFile, timestampExtension, this._rootDir, this._timestampDir);
		await this.writeTextFileAsync(file, "generated");
	}

	/**
	 * Given a list of files, determine which have been modified more recently than their corresponding timestamp files.
	 * (If the timestamp file doesn't exist, the original file is considered to be newer.) See
	 * {@link FileSystem#timestampFileFor} for more about timestamp files.
	 * @param {string[]} files The file paths to check.
	 * @param timestampExtension The timestamp file extension to use.
	 * @returns {Promise<string[]>} The files which have been modified.
	 */
	async findNewerFilesAsync(files, timestampExtension) {
		ensure.signature(arguments, [ Array, String ]);
		ensureValidPath(files, this._rootDir);

		const result = [];
		await Promise.all(files.map(async (file) => {
			const timestamp = timestampFilename(file, timestampExtension, this._rootDir, this._timestampDir);

			const isNewer = (await this.compareFileModificationTimesAsync(file, timestamp)) > 0;
			if (isNewer) result.push(file);
		}));
		return result;
	}

	/**
	 * Given a file and a list of comparison files, determine if the file has been modified more recently than ALL of the
	 * other files. This is useful for checking if a build output file needs to be recreated; if it's newer than all of
	 * the source files, it doesn't need to be recreated.
	 * @param {string} filename The file to check. (The output file.)
	 * @param {string[]} timestampFiles The files to compare against. (The input files.)
	 * @returns {Promise<boolean>} True if the output file has been modified more recently than all of the input files.
	 */
	async isFileNewerThanAllAsync(filename, timestampFiles) {
		ensure.signature(arguments, [ String, Array ]);
		ensureValidPath(filename, this._rootDir);

		const comparisons = await Promise.all(timestampFiles.map(async (compareTo) => {
			return await this.compareFileModificationTimesAsync(filename, compareTo);
		}));

		return (comparisons).every(compare => compare > 0);
	}

	/**
	 * Given two files, determine which has been modified more recently. Fulfills the standard `compare` specification,
	 * which says that the result should be negative if `leftFilename < rightFilename`, positive if `leftFilename >
	 * rightFilename`, and zero if `leftFilename === rightFilename`.
	 * @param leftFilename
	 * @param rightFilename
	 * @returns {Promise<number>} Negative if `leftFilename` is older; positive if `rightFilename` is older; and zero if
	 *   their modification times are the same.
	 */
	async compareFileModificationTimesAsync(leftFilename, rightFilename) {
		ensure.signature(arguments, [ String, String ]);
		ensureValidPath([ leftFilename, rightFilename ], this._rootDir);

		const [ left, right ] = await Promise.all([
			getMtime(this, leftFilename),
			getMtime(this, rightFilename),
		]);

		if (left.found && right.found) return left.mtime - right.mtime;
		else if (left.found && !right.found) return 1;
		else if (!left.found && right.found) return -1;
		else if (!left.found && !right.found) return 0;
		else ensure.unreachable(`Impossible combination of 'found' values: ${ { left, right } }`);

		async function getMtime(self, filename) {
			try {
				const mtime = await self.getFileModificationTimeAsync(filename);
				return { mtime, found: true };
			}
			catch (err) {
				if (err.code === "ENOENT") return { found: false };
				else throw err;
			}
		}
	}

};


function timestampFilename(originalFile, timestampExtension, rootDir, timestampDir) {
	const result = `${timestampDir}/${(path.relative(rootDir, originalFile))}.${timestampExtension}`;

	if (result.includes("../")) {
		throw new Error(`Timestamp file for '${originalFile}' is outside root directory '${rootDir}': ${result}`);
	}
	else {
		return result;
	}
}

function ensureValidPath(pathnames, rootDir) {
	if (!Array.isArray(pathnames)) pathnames = [ pathnames ];

	for (const pathname of pathnames) {
		if (!path.isAbsolute(pathname)) throw new Error(`Path must be absolute, but was: ${pathname}`);

		const relativePath = path.relative(rootDir, pathname);
		if (relativePath.includes("../")) throw new Error(`Path is outside of root dir '${rootDir}': ${pathname}`);
	}
}


class FsStub {

	constructor(files) {
		this._files = files;
	}

	async mkdir() {
		await fakeAsync();
	}

	async writeFile(filename) {
		await fakeAsync();
	}

	async readFile(filename) {
		await fakeAsync();

		const file = getNulledFile(this._files, filename);
		return file.content ?? `Nulled file content for '${filename}'`;
	}

	async readdir(directory) {
		await fakeAsync();

		if (!directory.endsWith("/")) directory += "/";
		const files = Object.keys(this._files).filter(file => file.startsWith(directory));
		return files.map(file => new DirentStub(file, true));
	}

	async rm(filename) {
		await fakeAsync();
	}

	async cp(src, dest) {
		await fakeAsync();
	}

	async stat(filename) {
		await fakeAsync();

		const file = getNulledFile(this._files, filename);
		return {
			mtime: new Date(file.modified ?? "1 Apr 1942 00:42:42.042 UTC"),
		};
	}

	watch(filename, options) {
		ensure.unreachable("Nulled FileSystem doesn't yet support file watching");
	}

}

class DirentStub {

	constructor(file, isFile) {
		this._parentPath = path.dirname(file);
		this._name = path.basename(file);
		this._isFile = isFile;
	}

	get parentPath() {
		return this._parentPath;
	}

	get name() {
		return this._name;
	}

	isFile() {
		return this._isFile;
	}

}

class RequireStub {

	constructor(files) {
		this._files = files;
	}

	resolve(module, { paths: [ basedir ] }) {
		// intentionally synchronous to match real behavior
		let resolved = path.resolve(basedir, module);
		if (this._files[resolved] === undefined) resolved += ".js";
		if (this._files[resolved] === undefined) {
			const err = new Error(`Cannot find module '${module}'\nrelative to '${basedir}'`);
			err.code = "MODULE_NOT_FOUND";
			throw err;
		}
		return resolved;
	}

}

function getNulledFile(files, filename) {
	if (files[filename] !== undefined) return files[filename];

	const err = new Error(`ENOENT: nulled FileSystem not configured with file '${filename}'`);
	err.code = "ENOENT";
	throw err;
}

async function fakeAsync() {
	await new Promise(resolve => setImmediate(resolve));
}
