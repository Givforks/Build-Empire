import { fireEvent, render, screen } from "@testing-library/react";
import BuildEmpireSection from "./BuildEmpireSection";

describe("BuildEmpireSection", () => {
  it("toggles identity content", () => {
    render(<BuildEmpireSection />);

    const toggleButton = screen.getByRole("button", { name: /show build.?empire identity/i });
    expect(toggleButton).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /build.?empire/i })).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByRole("heading", { level: 1, name: /build.?empire/i })).toBeInTheDocument();
    expect(screen.getByText(/innovation.*integrity.*impact/i)).toBeInTheDocument();
    expect(screen.getByText(/our mission at build.?empire/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hide build.?empire identity/i }));

    expect(screen.queryByRole("heading", { level: 1, name: /build.?empire/i })).not.toBeInTheDocument();
  });
});
