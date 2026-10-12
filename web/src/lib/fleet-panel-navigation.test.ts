import { expect, it } from "vitest";
import { ancestorsOf, parentChain } from "./nav";

it("panel has the ordinary root as its navigation parent", () => {
  expect(ancestorsOf("/panel")).toEqual(["/"]);
  expect(parentChain("/panel", "")).toEqual(["/"]);
});
