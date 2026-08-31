import { describe, expect, it } from "vitest";
import { assess } from "./password-strength";

describe("assess", () => {
  it("scores an empty password as empty with no label", () => {
    const s = assess("");
    expect(s.score).toBe(0);
    expect(s.tone).toBe("empty");
    expect(s.label).toBe("");
  });

  it("scores a short simple password as weak", () => {
    const s = assess("abc");
    expect(s.tone).toBe("weak");
    expect(s.label).toBe("Weak");
  });

  it("scores a long password passing every check as strong", () => {
    const s = assess("Abcdef12!longer");
    expect(s.score).toBe(4);
    expect(s.tone).toBe("strong");
    expect(s.checks.every((c) => c.ok)).toBe(true);
  });
});
