import { beforeEach, describe, expect, it } from "vitest";

import { FLEET_FRAME_ATTRIBUTE, markFleetFrame } from "./fleet-frame";

describe("Fleet frame presentation marker", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute(FLEET_FRAME_ATTRIBUTE);
    document.head.querySelectorAll("style").forEach((style) => style.remove());
  });

  it("marks a framed document idempotently without injecting style", () => {
    markFleetFrame(document.documentElement, true);
    markFleetFrame(document.documentElement, true);

    expect(document.documentElement).toHaveAttribute(FLEET_FRAME_ATTRIBUTE, "");
    expect(document.head.querySelectorAll("style")).toHaveLength(0);
  });

  it("leaves a top-level document unmarked and removes a stale marker", () => {
    document.documentElement.setAttribute(FLEET_FRAME_ATTRIBUTE, "");
    markFleetFrame(document.documentElement, false);

    expect(document.documentElement).not.toHaveAttribute(FLEET_FRAME_ATTRIBUTE);
  });
});
