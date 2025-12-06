import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisLayout } from "./AnalysisLayout";

describe("AnalysisLayout", () => {
  it("renders tabs and calls onTabChange", () => {
    const handler = vi.fn();
    render(
      <AnalysisLayout activeTab="overview" onTabChange={handler}>
        <div>child</div>
      </AnalysisLayout>,
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Voice"));
    expect(handler).toHaveBeenCalledWith("voice");
  });
});
