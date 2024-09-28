// Copyright Titanium I.T. LLC. License granted under terms of "The MIT License."
"use strict";

const { suite, assert } = require("tests");
const FileSystem = require("./file_system");
const FileTree = require("./file_tree");

module.exports = suite(({ it }) => {

	it("says if a file is in the tree", () => {
		const fileTree = FileTree.create([
			"/file",
		]);

		assert.equal(fileTree.has("/file"), true, "should have file");
		assert.equal(fileTree.has("/no_such_file"), false, "should not have file");
	});

	it("only knows about files, not directories", () => {
		const fileTree = FileTree.create([
			"/subdir/file",
		]);

		assert.equal(fileTree.has("/subdir/file"), true, "should have file in a subdirectory");
		assert.equal(fileTree.has("/subdir"), false, "should have not have subdirectory itself");
		assert.equal(fileTree.has("/subdir/"), false, "not even if it ends in a slash");
	});

	it("provides list of files that match glob", () => {
		const fileTree = FileTree.create([
			"/ignored/file1",
			"/ignored/file2",
			"/my_parent/file3",
			"/my_parent/file4",
			"/my_parent/child/file5",
		]);

		assert.deepEqual(fileTree.matchingFiles("/my_parent/**"), [
			"/my_parent/child/file5",
			"/my_parent/file3",
			"/my_parent/file4",
		]);
	});

	it("accepts multiple globs, and doesn't return same filename twice", () => {
		const fileTree = FileTree.create([
			"/ignored",
			"/file_a_1",
			"/file_a_2",
			"/file_b_1",
		]);

		assert.deepEqual(fileTree.matchingFiles([ "/file_a*", "/file*1" ]), [
			"/file_a_1",
			"/file_a_2",
			"/file_b_1",
		]);
	});

	it("ignores files that match optional 'exclude' glob", () => {
		const fileTree = FileTree.create([
			"/file1",
			"/file2",
		]);

		assert.deepEqual(fileTree.matchingFiles("**", "/*2" ), [
			"/file1",
		]);
	});

	it("allows multiple 'exclude' globs, and excludes files that match any of them", () => {
		const fileTree = FileTree.create([
			"/file1",
			"/file2a",
			"/file2b",
			"/file3",
		]);

		assert.deepEqual(fileTree.matchingFiles("**", [ "/*3", "/*b" ]), [
			"/file1",
			"/file2a",
		]);
	});

	it("can excludes files on creation", () => {
		const fileTree = FileTree.create([
			"/file1a",
			"/file1b",
			"/file2a",
			"/file2b",
			"/sub/file3",
			"/sub/file4",
		], [
			"/*a",
			"/sub/**",
		]);

		assert.deepEqual(fileTree.matchingFiles("**"), [
			"/file1b",
			"/file2b",
		]);
	});

	it("is immutable", () => {
		const files = [ "/file1" ];
		const fileTree = FileTree.create(files);

		files.push("/new_file");

		assert.deepEqual(fileTree.matchingFiles("**"), [ "/file1" ]);
	});

	it("supports equals(), which ignores order", () => {
		const fileTree1a = FileTree.create([
			"/file1",
			"/file2",
			"/file3",
		]);
		const fileTree1b = FileTree.create([
			"/file1",
			"/file3",
			"/file2",
		]);
		const fileTree2 = FileTree.create([
			"/file1",
			"/file3",
			"/file4",
		]);

		assert.equal(fileTree1a.equals(fileTree1b), true, "should be equal");
		assert.equal(fileTree1a.equals(fileTree2), false, "should not be equal");
	});

});