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
    select(label: string) {
      const match = [...container.querySelectorAll("label")].find((entry) =>
        entry.textContent?.includes(label),
      );
      const field = match?.querySelector("select");
      if (!field) throw new Error(`Missing select: ${label}`);
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

async function select(field: HTMLSelectElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("creates an E2B profile with a provider-neutral size", async () => {
  const view = await renderSettings("e2b");
  try {
    await change(view.input("Name"), "Powerful E2B");
    await select(view.select("Size"), "large");
    await act(async () => view.createButton().click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Powerful E2B",
      kind: "e2b",
      size: "large",
    });
  } finally {
    await view.cleanup();
  }
});

it("uses medium as the default size for every provider", async () => {
  const view = await renderSettings("docker");
  try {
    await change(view.input("Name"), "Normal Docker");
    expect(view.select("Size").value).toBe("medium");
    await act(async () => view.createButton().click());

    expect(api.create).toHaveBeenCalledWith({
      name: "Normal Docker",
      kind: "docker",
      size: "medium",
    });
  } finally {
    await view.cleanup();
  }
});
