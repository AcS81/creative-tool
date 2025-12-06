import { describe, expect, it } from "vitest";
import { isValidYouTubeUrl, parseYouTubeUrl } from "./youtube";

describe("YouTube URL parsing", () => {
  it("extracts videoId from standard watch URLs", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("extracts from youtu.be short links with params", () => {
    expect(parseYouTubeUrl("https://youtu.be/xyz789?t=30")).toBe("xyz789");
  });

  it("handles shorts, embed, and legacy /v routes", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/shorts/shortID?feature=share")).toBe(
      "shortID",
    );
    expect(parseYouTubeUrl("https://www.youtube.com/embed/embedID")).toBe("embedID");
    expect(parseYouTubeUrl("https://www.youtube.com/v/legacyID")).toBe("legacyID");
  });

  it("returns null for non-YouTube domains or missing ids", () => {
    expect(parseYouTubeUrl("https://google.com/watch?v=abc123")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/watch?feature=share")).toBeNull();
  });

  it("isValidYouTubeUrl reflects parsing success", () => {
    expect(isValidYouTubeUrl("https://youtu.be/okID")).toBe(true);
    expect(isValidYouTubeUrl("notaurl")).toBe(false);
  });
});
