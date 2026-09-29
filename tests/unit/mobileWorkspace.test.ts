import { createElement, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MobileNavigation, useMobileWorkspace } from "../../src/features/v2/hud/MobileWorkspace";

const { goTo } = vi.hoisted(() => ({ goTo: vi.fn() }));
vi.mock("../../src/features/v2/state", () => ({ useV2: () => ({ goTo }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function Workspace({ world = "home" }: { world?: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const mobile = useMobileWorkspace(world, rootRef);
  // eslint-disable-next-line react-hooks/refs -- createElement forwards the DOM ref; this harness never reads ref.current during render.
  return createElement("main", { ref: rootRef, "data-testid": "workspace", "data-view": mobile.view },
    createElement("input", { "aria-label": "Unfertiger Entwurf", defaultValue: "Bleibt erhalten" }),
    createElement(MobileNavigation, { view: mobile.view, onExplore: mobile.setExploring }));
}

it("switches presentation without replacing drafts or the existing navigation", () => {
  render(createElement(Workspace));
  const field = screen.getByLabelText("Unfertiger Entwurf");
  const rooms = vi.fn();
  window.addEventListener("hermes:rooms-open", rooms);
  fireEvent.click(screen.getByRole("button", { name: "Räume" }));
  expect(rooms).toHaveBeenCalledOnce();
  expect(screen.getByTestId("workspace")).toHaveAttribute("data-view", "rooms");
  fireEvent.click(screen.getByRole("button", { name: "Heute" }));
  expect(goTo).toHaveBeenCalledWith("home");
  expect(screen.getByTestId("workspace")).toHaveAttribute("data-view", "work");
  expect(screen.getByLabelText("Unfertiger Entwurf")).toBe(field);
  expect(field).toHaveValue("Bleibt erhalten");
  window.removeEventListener("hermes:rooms-open", rooms);
});

it("uses actual console visibility, including opening from a project draft", () => {
  render(createElement(Workspace));
  act(() => window.dispatchEvent(new CustomEvent("hermes:console-visibility", { detail: true })));
  expect(screen.getByRole("button", { name: "Hermes" })).toHaveAttribute("aria-current", "page");
  act(() => window.dispatchEvent(new CustomEvent("hermes:console-visibility", { detail: false })));
  expect(screen.getByRole("button", { name: "Heute" })).toHaveAttribute("aria-current", "page");
});

it("shows rooms when existing controls navigate to another world", () => {
  const { rerender } = render(createElement(Workspace));
  rerender(createElement(Workspace, { world: "projects" }));
  expect(screen.getByRole("button", { name: "Räume" })).toHaveAttribute("aria-current", "page");
});

it("follows visual viewport changes and removes keyboard listeners on unmount", () => {
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 });
  const remove = vi.spyOn(viewport, "removeEventListener");
  vi.stubGlobal("visualViewport", viewport);
  try {
    const { unmount } = render(createElement(Workspace));
    const root = screen.getByTestId("workspace");
    Object.assign(viewport, { height: 410, offsetTop: 22 });
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(root.style.getPropertyValue("--mobile-height")).toBe("410px");
    expect(root.style.getPropertyValue("--mobile-top")).toBe("22px");
    expect(root).toHaveAttribute("data-mobile-compact", "true");
    Object.assign(viewport, { scale: 2, height: 205 });
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(root.style.getPropertyValue("--mobile-height")).toBe("410px");
    unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  } finally { vi.unstubAllGlobals(); }
});
