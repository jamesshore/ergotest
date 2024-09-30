// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."

import * as ensure from "../util/ensure.js";
import fs from "node:fs/promises";
import path from "node:path";
import { OutputTracker } from "./low_level/output_tracker.js";
import EventEmitter from "node:events";

const EVENT = "write";

export interface NulledFileSystemConfiguration {
	[filename: string]: { content: string },
}

export type FileSystemOutput = string;

interface Fs {
	readFile(filename: string, options?: unknown): Promise<string | Buffer>,
}


/** Wrapper for the file system. */
export class FileSystem {

	/**
	 * Factory method. Create the wrapper.
	 * @returns {FileSystem} The wrapper.
	 */
	static create(): FileSystem {
		ensure.signature(arguments, []);

		return new FileSystem(fs);
	}

	/**
	 * Factory method. Create a stubbed file system with pre-configured data. It discards writes and other changes.
	 * @param {Object.<string, {content?: string}>} [files] The files in the stubbed file system. The
	 *   key is the filename and the value is an object. The object may contain two optional values: `content`, which
	 *   specifies the file contents; and `modified` which specifies the date that the file was last modified, as a
	 *   numeric timestamp).
	 * @returns {FileSystem} The stubbed file system.
	 */
	static createNull(files: NulledFileSystemConfiguration = {}): FileSystem {
		ensure.signature(arguments, [[ undefined, Object ]]);
		Object.entries(files).forEach(([ filename, configuration ]) => {
			ensure.that(
				path.isAbsolute(filename),
				`Nulled FileSystem must use absolute paths, but '${filename}' is relative`
			);
			ensure.type(configuration, {
				content: [ undefined, String ],
			}, `file '${filename}'`);
		});

		return new FileSystem(new FsStub(files));
	}

	private readonly _fs: Fs;
	private readonly _emitter: EventEmitter;

	/** For internal use only. (Use a factory method instead.) */
	constructor(fs: Fs) {
		this._fs = fs;
		this._emitter = new EventEmitter();
	}

	/**
	 * Track file operations.
	 * @returns {OutputTracker} The output tracker.
	 */
	track(): OutputTracker<FileSystemOutput> {
		return new OutputTracker(this._emitter, EVENT);
	}

	/**
	 * Read the contents of a file as text.
	 * @param {string} filename The path to the file.
	 * @returns {Promise<string>} The contents of the file.
	 */
	async readTextFileAsync(filename: string): Promise<string> {
		ensure.signature(arguments, [ String ]);

		const content = await this._fs.readFile(filename, { encoding: "utf8" });
		this._emitter.emit(EVENT, filename);
		return content.toString();
	}

}

class FsStub implements Fs {

	private readonly _files: NulledFileSystemConfiguration;

	constructor(files: NulledFileSystemConfiguration) {
		this._files = files;
	}

	async readFile(filename: string): Promise<string> {
		await fakeAsync();

		const file = getNulledFile(this._files, filename);
		return file.content ?? `Nulled file content for '${filename}'`;
	}

}

interface NodeError extends Error {
	code: string,
}

function getNulledFile(files: NulledFileSystemConfiguration, filename: string): { content: string } {
	if (files[filename] !== undefined) return files[filename];

	const err = new Error(`ENOENT: nulled FileSystem not configured with file '${filename}'`) as NodeError;
	err.code = "ENOENT";
	throw err;
}

async function fakeAsync() {
	await new Promise(resolve => setImmediate(resolve));
}
