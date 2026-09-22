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

async function renderSettings(kind: "docker" | "e2b") {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.create.mockClear();
  api.list.mockResolvedValue({ profiles: [], availableKinds: [kind], teamProfileId: null });
  api.create.mockResolvedValue({});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<ComputerProfilesSettings />));

  return {
    container,
    input(label: string) {
      const match = [...container.querySelectorAll("label")].find((entry) =>
        entry.textContent?.includes(label),
      );
      const field = match?.querySelector("input");
      if (!field) throw new Error(`Missing input: ${label}`);
      return field;
    },
    createButton() {
      const button = [...container.querySelectorAll("button")].find((entry) =>
        entry.textContent?.includes("Create profile"),
      );
      if (!button) throw new Error("Missing create button");
      return button;
    },
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

async function change(field: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("creates an E2B profile with managed template resources", async () => {
  const view = await renderSettings("e2b");
  try {
    await change(view.input("Name"), "Powerful E2B");
    await change(view.input("vCPUs"), "8");
    await change(view.input("Memory (MB)"), "16384");
    await change(view.input("Base template"), "desktop");
    await act(async () => view.createButton().click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Powerful E2B",
      kind: "e2b",
      template: "desktop",
      cpuCount: 8,
      memoryMB: 16_384,
    });
  } finally {
    await view.cleanup();
  }
});

it("uses an E2B base template unchanged when both resources are blank", async () => {
  const view = await renderSettings("e2b");
  try {
    await change(view.input("Name"), "Existing Desktop");
    expect(view.createButton().disabled).toBe(false);
    await act(async () => view.createButton().click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Existing Desktop",
      kind: "e2b",
      template: null,
      cpuCount: null,
      memoryMB: null,
    });
  } finally {
    await view.cleanup();
  }
});

it("requires E2B CPU and memory together", async () => {
  const view = await renderSettings("e2b");
  try {
    await change(view.input("Name"), "Partial E2B");
    await change(view.input("vCPUs"), "4");
    expect(view.createButton().disabled).toBe(true);
    await change(view.input("Memory (MB)"), "8192");
    expect(view.createButton().disabled).toBe(false);
  } finally {
    await view.cleanup();
  }
});

it("creates a Docker profile with per-container resources and no template", async () => {
  const view = await renderSettings("docker");
  try {
    await change(view.input("Name"), "Small Docker");
    await change(view.input("vCPUs"), "1");
    await change(view.input("Memory (MB)"), "1024");
    expect(view.container.textContent).not.toContain("Base template");
    await act(async () => view.createButton().click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Small Docker",
      kind: "docker",
      template: null,
      cpuCount: 1,
      memoryMB: 1024,
    });
  } finally {
    await view.cleanup();
  }
});

it("keeps Docker resources optional and explains the deployment defaults", async () => {
  const view = await renderSettings("docker");
  try {
    await change(view.input("Name"), "Default Docker");
    expect(view.container.textContent).toContain("Blank values use the deployment-wide Docker");
    expect(view.createButton().disabled).toBe(false);
    await act(async () => view.createButton().click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Default Docker",
      kind: "docker",
      template: null,
      cpuCount: null,
      memoryMB: null,
    });
  } finally {
    await view.cleanup();
  }
});
