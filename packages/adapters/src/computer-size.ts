export type ComputerSize = "small" | "medium" | "large";

const RESOURCES = {
  small: { cpuCount: 2, memoryMB: 4_096 },
  medium: { cpuCount: 4, memoryMB: 8_192 },
  large: { cpuCount: 8, memoryMB: 16_384 },
} as const satisfies Record<ComputerSize, { cpuCount: number; memoryMB: number }>;

export function computerSizeResources(size: ComputerSize) {
  return RESOURCES[size];
}

export function boatMachineType(size: ComputerSize) {
  return size === "medium" ? ("default" as const) : size;
}

export function createOSMachineShape(size: ComputerSize) {
  return size === "small" ? "s-2vcpu-2gb" : size === "medium" ? "s-4vcpu-8gb" : "s-8vcpu-16gb";
}
