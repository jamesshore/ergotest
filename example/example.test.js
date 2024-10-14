import { assert, test } from "./tests.js";

export default test(({ it }) => {

  it("runs tests", () => {
    assert.equal(2 + 2, 4);
  });

});