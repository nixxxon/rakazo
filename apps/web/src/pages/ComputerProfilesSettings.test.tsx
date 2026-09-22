// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  setTeam: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { computerProfiles: api } }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray) => parts.join("");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/ui-web", () => ({
  Button: (props: ComponentProps<"button">) => <button {...props} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
}));

import { ComputerProfilesSettings } from "./ComputerProfilesSettings";

it("creates an E2B profile with managed template resources", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.list.mockResolvedValue({ profiles: [], availableKinds: ["e2b"], teamProfileId: null });
  api.create.mockResolvedValue({});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const input = (label: string) => {
    const match = [...container.querySelectorAll("label")].find((entry) =>
      entry.textContent?.includes(label),
    );
    const field = match?.querySelector("input");
    if (!field) throw new Error(`Missing input: ${label}`);
    return field;
  };
  const change = async (field: HTMLInputElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(<ComputerProfilesSettings />));
    await change(input("Name"), "Powerful E2B");
    await change(input("vCPUs"), "8");
    await change(input("Memory (MB)"), "16384");
    await change(input("Base template"), "desktop");
    const create = [...container.querySelectorAll("button")].find((entry) =>
      entry.textContent?.includes("Create profile"),
    );
    if (!create) throw new Error("Missing create button");
    await act(async () => create.click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Powerful E2B",
      kind: "e2b",
      template: "desktop",
      cpuCount: 8,
      memoryMB: 16_384,
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("creates a Docker profile with per-container resources and no template", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.create.mockClear();
  api.list.mockResolvedValue({ profiles: [], availableKinds: ["docker"], teamProfileId: null });
  api.create.mockResolvedValue({});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const input = (label: string) => {
    const match = [...container.querySelectorAll("label")].find((entry) =>
      entry.textContent?.includes(label),
    );
    const field = match?.querySelector("input");
    if (!field) throw new Error(`Missing input: ${label}`);
    return field;
  };
  const change = async (field: HTMLInputElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(<ComputerProfilesSettings />));
    await change(input("Name"), "Small Docker");
    await change(input("vCPUs"), "1");
    await change(input("Memory (MB)"), "1024");
    expect(container.textContent).not.toContain("Base template");
    const create = [...container.querySelectorAll("button")].find((entry) =>
      entry.textContent?.includes("Create profile"),
    );
    if (!create) throw new Error("Missing create button");
    await act(async () => create.click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Small Docker",
      kind: "docker",
      template: null,
      cpuCount: 1,
      memoryMB: 1024,
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
