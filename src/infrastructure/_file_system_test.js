// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const ensure = require("../util/ensure");
const FileSystem = require("./file_system");
const FileTree = require("./file_tree");
const fs = require("node:fs/promises");
const Clock = require("./clock");

const IRRELEVANT_FILE_CONTENTS = "irrelevant file contents";

module.exports = suite(({ beforeAll, afterEach, describe }) => {

	let TEST_DIR;
	let FILENAME;

	beforeAll(async ({ getConfig }) => {
		TEST_DIR = getConfig("scratchDir");
		FILENAME = `${TEST_DIR}/my_file`;
		await deleteTempFilesAsync(TEST_DIR);
	});

	afterEach(async () => {
		await deleteTempFilesAsync(TEST_DIR);
	});


	describe("Reading and writing", ({ it, describe }) => {

		it("reads and writes files", async () => {
			const { fileSystem } = create();

			await fileSystem.writeTextFileAsync(FILENAME, "my file contents");
			const readContents = await fileSystem.readTextFileAsync(FILENAME);

			assert.deepEqual(readContents, "my file contents");
		});

		it("creates subdirectories as necessary", async () => {
			const { fileSystem } = create();
			const filename = `${TEST_DIR}/subdir1/subdir2/my_file`;

			await fileSystem.writeTextFileAsync(filename, IRRELEVANT_FILE_CONTENTS);
			assert.equal(await fileExistsAsync(filename), true, "file should exist");
		});

		it("fails when file can't be found", async () => {
			const { fileSystem } = create();

			try {
				await fileSystem.readTextFileAsync(`${TEST_DIR}/no_such_file`);
				assert.fail("should have thrown ENOENT error");
			}
			catch(err) {
				assert.equal(err.message, `ENOENT: no such file or directory, open '${TEST_DIR}/no_such_file'`);
				assert.equal(err.code, "ENOENT");
			}
		});

		it("tracks reads", async () => {
			const fileSystem = FileSystem.createNull({
				"/file1": {},
				"/file2": {},
			});
			const reads = fileSystem.track();

			await fileSystem.readTextFileAsync("/file1");
			await fileSystem.readTextFileAsync("/file2");

			assert.deepEqual(reads.data, [
				{ action: FileSystem.TRACK_ACTION.READ, filename: "/file1" },
				{ action: FileSystem.TRACK_ACTION.READ, filename: "/file2" },
			]);
		});

		it("tracks writes", async () => {
			const fileSystem = FileSystem.createNull();
			const writes = fileSystem.track();

			await fileSystem.writeTextFileAsync("/file1", "write 1");
			await fileSystem.writeTextFileAsync("/file2", "write 2");

			assert.deepEqual(writes.data, [
				{ action: FileSystem.TRACK_ACTION.WRITE, filename: "/file1", content: "write 1" },
				{ action: FileSystem.TRACK_ACTION.WRITE, filename: "/file2", content: "write 2" },
			]);
		});

		describe("Nulled", ({ it }) => {

			it("requires file paths to start with /", async () => {
				await assert.exceptionAsync(
					() => FileSystem.createNull({
						"no_starting_slash": {},
					}),
					"Nulled FileSystem must use absolute paths, but 'no_starting_slash' is relative",
				);
			});

			it("does nothing when writing", async () => {
				const fileSystem = FileSystem.createNull();

				await fileSystem.writeTextFileAsync(FILENAME, IRRELEVANT_FILE_CONTENTS);
				assert.equal(await fileExistsAsync(FILENAME), false, "file should not exist");
			});

			it("allows file content to be configured", async () => {
				const fileSystem = FileSystem.createNull({
					"/default": {},
					"/configured": { content: "my content" },
				});

				assert.equal(await fileSystem.readTextFileAsync("/default"), "Nulled file content for '/default'");
				assert.equal(await fileSystem.readTextFileAsync("/configured"), "my content");
			});

			it("throws ENOENT error when file hasn't been configured", async () => {
				const fileSystem = FileSystem.createNull();

				try {
					await fileSystem.readTextFileAsync("/no_such_file");
					assert.fail("should have thrown ENOENT error");
				}
				catch(err) {
					assert.equal(err.message, "ENOENT: nulled FileSystem not configured with file '/no_such_file'");
					assert.equal(err.code, "ENOENT");
				}
			});

		});

	});


	describe("Deleting", ({ it, describe }) => {

		it("deletes files and directory trees", async () => {
			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/sub/dir/file.txt`, IRRELEVANT_FILE_CONTENTS);

			await fileSystem.deleteAsync(`${TEST_DIR}/sub`);

			assert.equal(await fileExistsAsync(`${TEST_DIR}/sub/dir/file.txt`), false, "file should not exist");
			assert.equal(await fileExistsAsync(`${TEST_DIR}/sub`), false, "directory should not exist");
		});

		it("does nothing when file doesn't exist", async () => {
			const { fileSystem } = create();

			await assert.noExceptionAsync(
				() => fileSystem.deleteAsync(`${TEST_DIR}/no_such_file`),
			);
		});

		it("fails fast if file isn't inside the file system's root dir", async () => {
			const fileSystem = FileSystem.createNull({}, { rootDir: `${TEST_DIR}/sub` });

			await assert.exceptionAsync(
				() => fileSystem.deleteAsync(`${TEST_DIR}/outside_sub_dir`),
				`Path is outside of root dir '${TEST_DIR}/sub': ${TEST_DIR}/outside_sub_dir`,
			);
		});

		it("tracks deletes (regardless of whether file exists)", async () => {
			const fileSystem = FileSystem.createNull({
				"/exists": {},
			});

			const deletes = fileSystem.track();
			await fileSystem.deleteAsync("/exists");
			await fileSystem.deleteAsync("/does_not_exist");

			assert.deepEqual(deletes.data, [
				{ action: FileSystem.TRACK_ACTION.DELETE, filename: "/exists" },
				{ action: FileSystem.TRACK_ACTION.DELETE, filename: "/does_not_exist" },
			]);
		});

		describe("Nulled", ({ it }) => {

			it("does nothing when deleting", async () => {
				const { fileSystem: real } = create();
				const nulled = FileSystem.createNull();
				await real.writeTextFileAsync(FILENAME, IRRELEVANT_FILE_CONTENTS);

				await nulled.deleteAsync(FILENAME);

				assert.equal(await fileExistsAsync(FILENAME), true, "file should still exist");
			});

		});

	});


	describe("Copying", ({ it, describe }) => {

		it("copies files", async () => {
			const sourceFile = `${TEST_DIR}/source_file`;
			const destFile = `${TEST_DIR}/destination_file`;

			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(sourceFile, IRRELEVANT_FILE_CONTENTS);

			await fileSystem.copyAsync(sourceFile, destFile);

			assert.equal(await fileExistsAsync(destFile), true, "file should be copied");
		});

		it("fails when file can't be found", async () => {
			const { fileSystem } = create();

			try {
				await fileSystem.copyAsync(`${TEST_DIR}/no_such_file`, FILENAME);
				assert.fail("should have thrown ENOENT error");
			}
			catch(err) {
				assert.equal(err.message, `ENOENT: no such file or directory, lstat '${TEST_DIR}/no_such_file'`);
				assert.equal(err.code, "ENOENT");
			}
		});

		it("creates subdirectories as needed", async () => {
			const sourceFile = `${TEST_DIR}/source_file`;
			const destFile = `${TEST_DIR}/sub/dir/destination_file`;

			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(sourceFile, IRRELEVANT_FILE_CONTENTS);

			await fileSystem.copyAsync(sourceFile, destFile);

			assert.equal(await fileExistsAsync(destFile), true, "file should be copied");
		});

		it("overwrites existing files", async () => {
			const sourceFile = `${TEST_DIR}/source_file`;
			const destFile = `${TEST_DIR}/destination_file`;

			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(sourceFile, "source");
			await fileSystem.writeTextFileAsync(destFile, "dest");

			await fileSystem.copyAsync(sourceFile, destFile);

			assert.equal(await fileSystem.readTextFileAsync(destFile), "source");
		});

		it("copies directory trees", async () => {
			const sourceFile = `${TEST_DIR}/source/dir/my_file`;
			const destFile = `${TEST_DIR}/dest/dir/my_file`;

			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(sourceFile, IRRELEVANT_FILE_CONTENTS);

			await fileSystem.copyAsync(`${TEST_DIR}/source`, `${TEST_DIR}/dest`);

			assert.equal(await fileExistsAsync(destFile), true, "file should be copied");
		});

		it("tracks copies", async () => {
			const fileSystem = FileSystem.createNull();
			const tracker = fileSystem.track();

			await fileSystem.copyAsync("/my_src", "/my_dest");

			assert.deepEqual(tracker.data, [
				{ action: FileSystem.TRACK_ACTION.COPY, src: "/my_src", dest: "/my_dest" },
			]);
		});

		describe("Nulled", ({ it }) => {

			it("does nothing when copying, and ignores file existence", async () => {
				const sourceFile = `${TEST_DIR}/source_file`;
				const destFile = `${TEST_DIR}/destination_file`;

				const fileSystem = FileSystem.createNull();
				await fileSystem.copyAsync(sourceFile, destFile);

				assert.equal(await fileExistsAsync(destFile), false, "should have done nothing");
			});

		});

	});



	// These tests have race conditions that I can't figure out how to resolve. Uncomment them when making changes
	// to the watch functionality; otherwise, it's best to leave them out.

	// describe("Watching", ({ beforeEach, it, describe }) => {
	//
	// 	let WATCH_TEST_DIR;
	// 	let nonce = 0;
	//
	// 	beforeEach(async () => {
	// 		// File watching has a lot of race conditions, so we run each test a directory with a unique name.
	// 		WATCH_TEST_DIR = `${TEST_DIR}/watch/${nonce++}`;
	// 		await fs.mkdir(WATCH_TEST_DIR, { recursive: true });
	// 	});
	//
	// 	it("waits until a file is added, deleted, renamed, or changed", async () => {
	// 		// Due to race conditions, we can only test the 'added' part. But the fs.watch() API notifies on all of them.
	// 		const { fileSystem } = create({ rootDir: WATCH_TEST_DIR });
	//
	// 		const watchPromise = fileSystem.waitForChangeAsync();
	// 		await fileSystem.writeTextFileAsync(`${WATCH_TEST_DIR}/my_file`, IRRELEVANT_FILE_CONTENTS);
	//
	// 		assert.deepEqual(await watchPromise, {
	// 			changed: FileSystem.CHANGED.TREE,
	// 			filename: `${WATCH_TEST_DIR}/my_file`
	// 		});
	// 	});
	//
	// 	it("when a list of globs is provided, only registers changes that match a glob in the list", async () => {
	// 		const { fileSystem } = create({ rootDir: WATCH_TEST_DIR });
	//
	// 		const watchPromise = fileSystem.waitForChangeAsync([ "unmatched_glob", "**/*detect" ]);
	//
	// 		await fileSystem.writeTextFileAsync(`${WATCH_TEST_DIR}/my_file`, IRRELEVANT_FILE_CONTENTS);
	// 		await fileSystem.writeTextFileAsync(`${WATCH_TEST_DIR}/my_file_detect`, IRRELEVANT_FILE_CONTENTS);
	//
	// 		assert.equal((await watchPromise).filename, `${WATCH_TEST_DIR}/my_file_detect`);
	// 	});
	//
	// 	it("works when a subdirectory is added, deleted, renamed, or changed", async () => {
	// 		const { fileSystem } = create({ rootDir: WATCH_TEST_DIR });
	//
	// 		const watchPromise = fileSystem.waitForChangeAsync();
	// 		await fs.mkdir(`${WATCH_TEST_DIR}/subdir`);
	//
	// 		assert.equal((await watchPromise).filename, `${WATCH_TEST_DIR}/subdir`);
	// 	});
	//
	// 	it("works recursively", async () => {
	// 		const { fileSystem } = create({ rootDir: WATCH_TEST_DIR });
	//
	// 		const watchPromise1 = fileSystem.waitForChangeAsync();
	// 		await fs.mkdir(`${WATCH_TEST_DIR}/subdir1`);
	// 		assert.equal((await watchPromise1).filename, `${WATCH_TEST_DIR}/subdir1`);
	//
	// 		// This will time out if the recursion isn't working
	// 		const watchPromise2 = fileSystem.waitForChangeAsync();
	// 		await fs.mkdir(`${WATCH_TEST_DIR}/subdir1/subdir2`);
	// 		assert.equal((await watchPromise2).filename, `${WATCH_TEST_DIR}/subdir1/subdir2`);
	// 	});
	//
	// 	it("says if a file is changed", async () => {
	// 		// Can't be tested due to race conditions, but the API looks like this:
	// 	});
	//
	// 	it("only watches files inside the root directory", async () => {
	// 		// Can't be tested directly due to race conditions, but you can infer that it works because the nonce works.
	// 		// Try removing the '++' from the nonce and watch the tests fail. QED.
	// 	});
	//
	// });


	describe("File trees", ({ it, describe }) => {

		it("provides files in a directory, recursively", async () => {
			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/file1`, IRRELEVANT_FILE_CONTENTS);
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/file2`, IRRELEVANT_FILE_CONTENTS);
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/sub1/file3`, IRRELEVANT_FILE_CONTENTS);
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/sub2/file4`, IRRELEVANT_FILE_CONTENTS);

			assert.objEqual(await fileSystem.readFileTreeAsync(TEST_DIR), FileTree.create([
				`${TEST_DIR}/file1`,
				`${TEST_DIR}/file2`,
				`${TEST_DIR}/sub2/file4`,
				`${TEST_DIR}/sub1/file3`,
			]));
		});

		it("fails fast if asked to read a file rather than a directory", async () => {
			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(FILENAME, IRRELEVANT_FILE_CONTENTS);

			await assert.exceptionAsync(
				() => fileSystem.readFileTreeAsync(FILENAME),
				/ENOTDIR/,
			);
		});

		it("fails fast if asked to read directory outside the file system root", async () => {
			const fileSystem = FileSystem.createNull({}, {
				rootDir: "/my_root",
			});

			await assert.exceptionAsync(
				() => fileSystem.readFileTreeAsync("/outside_root"),
				"Path is outside of root dir '/my_root': /outside_root",
			);
		});

		describe("Nulled", ({ it }) => {

			it("provides appropriate subset of configured files", async () => {
				const fileSystem = FileSystem.createNull({
					"/ignored1": {},
					"/other_sub/ignored2": {},
					"/my_parent/file1": {},
					"/my_parent/file2": {},
					"/my_parent/my_child/file3": {},
					"/my_parent/my_child/file4": {},
				});

				assert.objEqual(await fileSystem.readFileTreeAsync("/my_parent"), FileTree.create([
					"/my_parent/file1",
					"/my_parent/file2",
					"/my_parent/my_child/file3",
					"/my_parent/my_child/file4",
				]));
			});

			it("doesn't match partial directories", async () => {
				const fileSystem = FileSystem.createNull({
					"/legit/file1": {},
					"/legit_not/file2": {},
				});

				assert.objEqual(await fileSystem.readFileTreeAsync("/legit"), FileTree.create([
					"/legit/file1",
				]));
			});

			it("works if path ends in /", async () => {
				const fileSystem = FileSystem.createNull({
					"/sub/file": {},
				});

				assert.objEqual(await fileSystem.readFileTreeAsync("/sub/"), FileTree.create([
					"/sub/file",
				]));
			});

		});


	});


	describe("Node modules", ({ it }) => {

		it("resolves Node module paths", async () => {
			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/my_dependency.txt`, IRRELEVANT_FILE_CONTENTS);
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/no_extension`, IRRELEVANT_FILE_CONTENTS);

			assert.equal(
				await fileSystem.resolveModulePathAsync(TEST_DIR, "./my_dependency.txt"),
				`${TEST_DIR}/my_dependency.txt`
			);
			assert.equal(
				await fileSystem.resolveModulePathAsync(TEST_DIR, "./no_extension"),
				`${TEST_DIR}/no_extension`
			);
		});

		it("fails when module can't be found", async () => {
			const { fileSystem } = create();

			try {
				await fileSystem.resolveModulePathAsync(TEST_DIR, "./no_such_module");
				assert.fail("should have thrown MODULE_NOT_FOUND error");
			}
			catch(err) {
				assert.match(err.message, /Cannot find module '\.\/no_such_module'/);
				assert.equal(err.code, "MODULE_NOT_FOUND");
			}
		});

		it("tries '.js' extension if module not found, even if module already has an extension", async () => {
			const { fileSystem } = create();
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/my_module.js`, IRRELEVANT_FILE_CONTENTS);
			await fileSystem.writeTextFileAsync(`${TEST_DIR}/my_module.txt.js`, IRRELEVANT_FILE_CONTENTS);

			assert.equal(
				await fileSystem.resolveModulePathAsync(TEST_DIR, "./my_module"),
				`${TEST_DIR}/my_module.js`
			);
			assert.equal(
				await fileSystem.resolveModulePathAsync(TEST_DIR, "./my_module.txt"),
				`${TEST_DIR}/my_module.txt.js`
			);
		});

		it("tracks resolutions", async () => {
			const fileSystem = FileSystem.createNull({
				"/file1": {},
				"/file2": {},
			});
			const resolutions = fileSystem.track();

			await fileSystem.resolveModulePathAsync("/", "./file1");
			await fileSystem.resolveModulePathAsync("/", "./file2");

			assert.deepEqual(resolutions.data, [
				{ action: FileSystem.TRACK_ACTION.MODULE_RESOLUTION, resolvedFilename: "/file1" },
				{ action: FileSystem.TRACK_ACTION.MODULE_RESOLUTION, resolvedFilename: "/file2" },
			]);
		});

		describe("Nulled", ({ it }) => {

			it("resolves module paths in nulled file systems", async () => {
				const fileSystem = FileSystem.createNull({
					"/subdir/my_dependency.txt": {},
				});

				assert.equal(
					await fileSystem.resolveModulePathAsync("/subdir", "./my_dependency.txt"),
					"/subdir/my_dependency.txt"
				);
			});

			it("adds '.js' extension if module can't be found", async () => {
				const fileSystem = FileSystem.createNull({
					"/my_module.js": {},
					"/my_module.txt.js": {},
				});

				assert.equal(await fileSystem.resolveModulePathAsync("/", "./my_module"), "/my_module.js");
				assert.equal(await fileSystem.resolveModulePathAsync("/", "./my_module.txt"), "/my_module.txt.js");
			});

			it("doesn't attempt to fully match Node algorithm (e.g., doesn't resolve node_modules directories)", async () => {
				const fileSystem = FileSystem.createNull({
					"/node_modules/my_module.js": {},
				});
				await assert.exceptionAsync(
					() => fileSystem.resolveModulePathAsync("/", "my_module.js"),
					/Cannot find module/,
				);
			});

			it("throws MODULE_NOT_FOUND error when module isn't found, but doesn't keep require stack", async () => {
				const fileSystem = FileSystem.createNull();

				try {
					await fileSystem.resolveModulePathAsync("/root_dir", "./no_such_module");
					assert.fail("should have thrown MODULE_NOT_FOUND error");
				}
				catch(err) {
					assert.equal(err.message, "Cannot find module './no_such_module'\nrelative to '/root_dir'");
					assert.equal(err.code, "MODULE_NOT_FOUND");
				}
			});

		});

	});


	describe("Timestamps", ({ it }) => {

		it("provides last modified timestamp", async () => {
			const clock = Clock.create();
			const { fileSystem } = create();

			const start = clock.now();
			await fileSystem.writeTextFileAsync(FILENAME, IRRELEVANT_FILE_CONTENTS);
			const end = clock.now() + 1; // test needs a little slop to prevent race condition

			const modified = await fileSystem.getFileModificationTimeAsync(FILENAME);
			assert.between(modified.valueOf(), start, end);
		});

		it("fails when asked for modification time and file can't be found", async () => {
			const { fileSystem } = create();

			try {
				await fileSystem.getFileModificationTimeAsync(`${TEST_DIR}/no_such_file`);
				assert.fail("should have thrown ENOENT error");
			}
			catch(err) {
				assert.equal(err.message, `ENOENT: no such file or directory, stat '${TEST_DIR}/no_such_file'`);
				assert.equal(err.code, "ENOENT");
			}
		});

		it("compares two files' modification times", async () => {
			const fileSystem = FileSystem.createNull({
				"/older": { modified: 1500 },
				"/same": { modified: 1500 },
				"/newer": { modified: 1501 },
			});

			assert.equal(await fileSystem.compareFileModificationTimesAsync("/older", "/newer"), -1, "older to newer");
			assert.equal(await fileSystem.compareFileModificationTimesAsync("/older", "/same"), 0, "older to same");
			assert.equal(await fileSystem.compareFileModificationTimesAsync("/newer", "/older"), 1, "newer to older");
		});

		it("checks if a file is newer than a list of other files", async () => {
			const fileSystem = FileSystem.createNull({
				"/my_file": { modified: 1500 },
				"/older1": { modified: 1499 },
				"/older2": { modified: 1499 },
				"/same1": { modified: 1500 },
				"/newer1": { modified: 1501 },
			});

			assert.equal(
				await fileSystem.isFileNewerThanAllAsync("/my_file", [ "/older1", "/older2" ]),
				true,
				"newer than all files",
			);
			assert.equal(
				await fileSystem.isFileNewerThanAllAsync("/my_file", [ "/older1", "/newer1", "/older2" ]),
				false,
				"newer than all but one file",
			);
			assert.equal(
				await fileSystem.isFileNewerThanAllAsync("/my_file", [ "/older1", "/same1", "/older2" ]),
				false,
				"same age doesn't count as being newer",
			);
			assert.equal(
				await fileSystem.isFileNewerThanAllAsync("/my_file", []),
				true,
				"is always newer when there's no source files",
			);
		});

		it("considers 'not existing' to be old when doing modification time comparisons", async () => {
			const fileSystem = FileSystem.createNull({
				"/exists": {},
			});

			assert.equal(await fileSystem.compareFileModificationTimesAsync("/exists", "/not_exists"), 1, "exists > not_exists");
			assert.equal(await fileSystem.compareFileModificationTimesAsync("/not_exists", "/exists"), -1, "not_exists < exists");
			assert.equal(await fileSystem.compareFileModificationTimesAsync("/not_exists", "/not_exists"), 0, "not_exists = not_exists");

			assert.equal(await fileSystem.isFileNewerThanAllAsync("/exists", [ "/not_exists" ]), true, "multiple files");
		});

		describe("Nulled", ({ it }) => {

			it("allows nulled file modification time to be configured", async () => {
				const DEFAULT = new Date("1 Apr 1942 00:42:42.042 UTC");
				const fileSystem = FileSystem.createNull({
					"/default": {},
					"/configured": { modified: 1500 }
				});

				assert.deepEqual(await fileSystem.getFileModificationTimeAsync("/default"), DEFAULT, "default");
				assert.deepEqual(await fileSystem.getFileModificationTimeAsync("/configured"), new Date(1500), "configured");
			});

			it("throws ENOENT error when file hasn't been configured", async () => {
				const fileSystem = FileSystem.createNull();

				try {
					await fileSystem.getFileModificationTimeAsync("/no_such_file");
					assert.fail("should have thrown ENOENT error");
				}
				catch(err) {
					assert.equal(err.message, "ENOENT: nulled FileSystem not configured with file '/no_such_file'");
					assert.equal(err.code, "ENOENT");
				}
			});

		});

	});


	describe("Timestamp files", ({ it }) => {

		it("provides name of timestamp file based on original file", () => {
			const fileSystem = FileSystem.createNull({}, {
				rootDir: "/",
				timestampDir: "/comps",
			});

			assert.equal(fileSystem.timestampFileFor("/my_file", "ext"), "/comps/my_file.ext");
			assert.equal(fileSystem.timestampFileFor("/my_file.txt", "ext"), "/comps/my_file.txt.ext");
		});

		it("locates timestamp file relative to root directory", () => {
			const fileSystem = FileSystem.createNull({}, {
				rootDir: "/my/subdir",
				timestampDir: "/comps",
			});

			assert.equal(fileSystem.timestampFileFor("/my/subdir/child/dir/file", "ext"), "/comps/child/dir/file.ext");
		});

		it("fails fast if timestamp file would be written outside of root directory", () => {
			const fileSystem = FileSystem.createNull({}, {
				rootDir: "/my/subdir",
				timestampDir: "/comps",
			});

			assert.exception(
				() => fileSystem.timestampFileFor("/file", "ext"),
				"Timestamp file for '/file' is outside root directory '/my/subdir': /comps/../../file.ext",
			);
		});

		it("writes timestamp file", async () => {
			const fileSystem = FileSystem.createNull({}, {
				rootDir: "/",
				timestampDir: "/comps",
			});

			const writes = fileSystem.track();
			await fileSystem.writeTimestampFileAsync("/original_file.txt", "my_extension");

			assert.deepEqual(writes.data, [
				{ action: FileSystem.TRACK_ACTION.WRITE, filename: "/comps/original_file.txt.my_extension", content: "generated" },
			]);
		});

		it("provides a list of files that are newer than their timestamp files", async () => {
			const fileSystem = FileSystem.createNull({
				"/comps/file1.txt.ext": { modified: 100 },
				"/comps/file2.txt.ext": { modified: 300 },
				"/comps/file3.txt.ext": { modified: 100 },
				"/file1.txt": { modified: 150 },
				"/file2.txt": { modified: 150 },
				"/file3.txt": { modified: 150 },
			}, {
				rootDir: "/",
				timestampDir: "/comps",
			});

			const files = [ "/file1.txt", "/file2.txt", "/file3.txt" ];
			assert.deepEqual(
				await fileSystem.findNewerFilesAsync(files, "ext"),
				[ "/file1.txt", "/file3.txt" ]
			);
		});

	});

	function create({
		rootDir = TEST_DIR,
	} = {}) {
		ensure.signature(arguments, [[ undefined, {
			rootDir: [ undefined, String ],
		}]]);

		return {
			fileSystem: FileSystem.create(rootDir, ""),
		};
	}

	async function fileExistsAsync(filename) {
		try {
			await fs.stat(filename);
			return true;
		}
		catch (err) {
			if (err.code === "ENOENT") return false;
			else throw err;
		}
	}

	async function deleteTempFilesAsync(testDir) {
		await fs.rm(testDir, { recursive: true, force: true });
	}

});
