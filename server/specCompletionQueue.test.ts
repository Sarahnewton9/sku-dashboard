import { describe, expect, it } from "vitest";
import {
  getSpecTemplateComponentKeys,
  isNewSpecStyleAwaitingCompletion,
} from "@shared/specCompletionQueue";

describe("Specs new-SKU completion queue", () => {
  it("queues only styles with unfinished new SKU columns", () => {
    expect(isNewSpecStyleAwaitingCompletion({ newSkus: 2, specStatus: "not_started" })).toBe(true);
    expect(isNewSpecStyleAwaitingCompletion({ newSkus: 2, specStatus: "in_progress" })).toBe(true);
    expect(isNewSpecStyleAwaitingCompletion({ newSkus: 2, specStatus: "complete" })).toBe(false);
    expect(isNewSpecStyleAwaitingCompletion({ newSkus: 0, specStatus: "not_started" })).toBe(false);
  });

  it("recognises current and legacy template row keys", () => {
    expect(getSpecTemplateComponentKeys([
      "t:upper_1",
      "template:sole",
      "c:42",
      "deleted:t:lining",
      "t:upper_1",
    ])).toEqual(["upper_1", "sole"]);
  });
});
