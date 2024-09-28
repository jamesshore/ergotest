// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const ensure = require("../util/ensure");
const FileSystem = require("./file_system");
const fs = require("node:fs/promises");

module.exports = suite(({ beforeAll, afterEach, describe }) => {

	let TEST_DIR;
	let FILENAME;

	beforeAll(async ({ getConfig }) => {
		TEST_DIR = getConfig("scratchDir");
		FILENAME = `${TEST_DIR}/my_file`;
		await deleteTempFilesAsync(TEST_DIR);
		await fs.mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await deleteTempFilesAsync(TEST_DIR);
	});


	describe("Reading", ({ it, describe }) => {

		it("reads files", async () => {
			const { fileSystem } = create();

			await fs.writeFile(FILENAME, "my file contents");
			const readContents = await fileSystem.readTextFileAsync(FILENAME);

			assert.deepEqual(readContents, "my file contents");
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
				"/file1",
				"/file2",
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


	function create() {
		ensure.signature(arguments, []);

		return {
			fileSystem: FileSystem.create(),
		};
	}

	async function deleteTempFilesAsync(testDir) {
		await fs.rm(testDir, { recursive: true, force: true });
	}

});
