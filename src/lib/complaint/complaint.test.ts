import { describe, expect, it } from "vitest";
import { TEST_CASES } from "./testcases";

describe("Restaurant Complaint Tracker — documented test cases", () => {
  for (const tc of TEST_CASES) {
    it(`${tc.id} ${tc.title}`, () => {
      const r = tc.run();
      expect(r.pass, r.detail).toBe(true);
    });
  }
});
