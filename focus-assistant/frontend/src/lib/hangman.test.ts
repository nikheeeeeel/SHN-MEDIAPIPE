import { describe, expect, it } from "vitest";

import {
  HANGMAN_MAX_PARTS,
  hangmanParts,
  hangmanRemaining,
  hasLostHangman,
} from "./hangman";

describe("hangman score", () => {
  it("draws one part per flag up to six", () => {
    expect(hangmanParts(0)).toBe(0);
    expect(hangmanParts(2)).toBe(2);
    expect(hangmanParts(6)).toBe(HANGMAN_MAX_PARTS);
    expect(hangmanParts(99)).toBe(HANGMAN_MAX_PARTS);
  });

  it("reports remaining parts and loss", () => {
    expect(hangmanRemaining(0)).toBe(6);
    expect(hangmanRemaining(4)).toBe(2);
    expect(hangmanRemaining(6)).toBe(0);
    expect(hasLostHangman(5)).toBe(false);
    expect(hasLostHangman(6)).toBe(true);
  });
});
