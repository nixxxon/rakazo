import { describe, expect, it } from "vitest";
import { boatMachineType, computerSizeResources, createOSMachineShape } from "./computer-size.js";

describe("computer profile sizes", () => {
  it.each([
    ["small", 2, 4_096],
    ["medium", 4, 8_192],
    ["large", 8, 16_384],
  ] as const)("maps %s to portable resources", (size, cpuCount, memoryMB) => {
    expect(computerSizeResources(size)).toEqual({ cpuCount, memoryMB });
  });

  it.each([
    ["small", "small"],
    ["medium", "default"],
    ["large", "large"],
  ] as const)("maps %s to Boat's %s machine type", (size, machineType) => {
    expect(boatMachineType(size)).toBe(machineType);
  });

  it.each([
    ["small", "s-2vcpu-2gb"],
    ["medium", "s-4vcpu-8gb"],
    ["large", "s-8vcpu-16gb"],
  ] as const)("maps %s to CreateOS shape %s", (size, shape) => {
    expect(createOSMachineShape(size)).toBe(shape);
  });
});
