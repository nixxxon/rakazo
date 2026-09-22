import { homedir } from "node:os";
import type {
  AdapterContext,
  CommandRequest,
  ComputerActionRequest,
  ComputerInput,
  ComputerRef,
  ControlLeaseRef,
  PortableFile,
  ProcessEvent,
  SandboxProvider,
  ScreenRequest,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { DesktopSandboxProvider } from "./desktop-sandbox.js";
import { createSandboxProvider, type SandboxProviderOptions } from "./sandbox-factory.js";

export function sandboxKindForBot(envKind: string, computerHost: string | null | undefined) {
  if (envKind === "docker" && computerHost === "this-mac") return "desktop";
  return envKind;
}

export function createRunSandbox(
  kind: string,
  opts: SandboxProviderOptions & { prisma?: PrismaClient },
): SandboxProvider {
  const primary = createSandboxProvider(kind, opts);
  const host = new DesktopSandboxProvider({
    root: opts.dataDir,
    hostRoots: [homedir()],
  });
  const providers = new Map<string, SandboxProvider>();
  if (opts.supervisorToken && kind !== "docker") {
    providers.set("docker", createSandboxProvider("docker", opts));
  }
  if (opts.e2bApiKey?.trim() && kind !== "e2b") {
    providers.set("e2b", createSandboxProvider("e2b", opts));
  }
  if (opts.daytonaApiKey?.trim() && kind !== "daytona") {
    providers.set("daytona", createSandboxProvider("daytona", opts));
  }
  if (opts.boxApiKey?.trim() && kind !== "box") {
    providers.set("box", createSandboxProvider("box", opts));
  }
  if (kind === "desktop") return host;
  if (!opts.prisma && providers.size === 0) return primary;
  return new HostAwareSandbox(
    primary,
    host,
    async () => {
      if (kind !== "docker" || !opts.prisma) return false;
      const settings = await opts.prisma!.deploymentSettings.findUnique({
        where: { id: "default" },
      });
      return settings?.computerHost === "this-mac";
    },
    providers,
  );
}

export function configuredSandboxKinds(kind: string, opts: SandboxProviderOptions) {
  const kinds = new Set<string>([kind]);
  if (opts.supervisorToken) kinds.add("docker");
  if (opts.e2bApiKey?.trim()) kinds.add("e2b");
  if (opts.daytonaApiKey?.trim()) kinds.add("daytona");
  if (opts.boxApiKey?.trim()) kinds.add("box");
  return [...kinds].filter(
    (entry): entry is "docker" | "e2b" | "daytona" | "box" =>
      entry === "docker" || entry === "e2b" || entry === "daytona" || entry === "box",
  );
}

export class HostAwareSandbox implements SandboxProvider {
  readonly pageBrowser?: SandboxProvider["pageBrowser"];

  constructor(
    private readonly isolated: SandboxProvider,
    private readonly host: SandboxProvider,
    private readonly hostEnabled: () => Promise<boolean>,
    private readonly providers = new Map<string, SandboxProvider>(),
  ) {
    if (
      isolated.pageBrowser ||
      host.pageBrowser ||
      [...providers.values()].some((p) => p.pageBrowser)
    ) {
      this.pageBrowser = (computer, request, context) => {
        const provider = this.route(computer);
        return provider.pageBrowser
          ? provider.pageBrowser(computer, request, context)
          : Promise.resolve({
              ok: false,
              uncertain: false,
              fallback: "computer_act",
              error: "Page browser is unavailable on this computer.",
            });
      };
    }
  }

  describe() {
    return this.isolated.describe();
  }

  private route(computer: ComputerRef) {
    if (computer.kind === "desktop") return this.host;
    if (computer.kind === this.isolated.describe().id) return this.isolated;
    const provider = this.providers.get(computer.kind);
    if (!provider) throw new Error(`Computer provider ${computer.kind} is not configured`);
    return provider;
  }

  async provision(
    request: {
      botId: string;
      homePath: string;
      providerRef?: string;
      providerKind?: ComputerRef["kind"];
    },
    context: AdapterContext,
  ) {
    const requestedKind = request.providerKind ?? this.isolated.describe().id;
    const useHost =
      (request.providerKind === undefined || requestedKind === "docker") &&
      (await this.hostEnabled());
    const provider = useHost
      ? this.host
      : requestedKind === "desktop"
        ? this.host
        : requestedKind === this.isolated.describe().id
          ? this.isolated
          : this.providers.get(requestedKind);
    if (!provider) throw new Error(`Computer provider ${requestedKind} is not configured`);
    const providerKind = provider.describe().id;
    return provider.provision(
      {
        ...request,
        providerRef: request.providerKind === providerKind ? request.providerRef : undefined,
      },
      context,
    );
  }

  prepare(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).prepare(computer, context);
  }

  async *execute(
    computer: ComputerRef,
    request: CommandRequest,
    context: AdapterContext,
  ): AsyncIterable<ProcessEvent> {
    yield* this.route(computer).execute(computer, request, context);
  }

  connectScreen(computer: ComputerRef, request: ScreenRequest, context: AdapterContext) {
    return this.route(computer).connectScreen(computer, request, context);
  }

  sendInput(
    computer: ComputerRef,
    input: ComputerInput,
    lease: ControlLeaseRef,
    context: AdapterContext,
  ) {
    return this.route(computer).sendInput(computer, input, lease, context);
  }

  observe(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).observe(computer, context);
  }

  act(computer: ComputerRef, request: ComputerActionRequest, context: AdapterContext) {
    return this.route(computer).act(computer, request, context);
  }

  listFiles(computer: ComputerRef, path: string, context: AdapterContext) {
    return this.route(computer).listFiles(computer, path, context);
  }

  readFile(
    computer: ComputerRef,
    path: string,
    context: AdapterContext,
    options?: { maxBytes?: number },
  ) {
    return this.route(computer).readFile(computer, path, context, options);
  }

  writeFile(computer: ComputerRef, file: PortableFile, context: AdapterContext) {
    return this.route(computer).writeFile(computer, file, context);
  }

  exportWorkspace(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).exportWorkspace(computer, context);
  }

  importWorkspace(
    computer: ComputerRef,
    files: AsyncIterable<PortableFile>,
    context: AdapterContext,
  ) {
    return this.route(computer).importWorkspace(computer, files, context);
  }

  snapshot(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).snapshot(computer, context);
  }

  keepAlive(computer: ComputerRef) {
    return this.route(computer).keepAlive?.(computer) ?? Promise.resolve();
  }

  releaseScreen(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).releaseScreen?.(computer, context) ?? Promise.resolve();
  }

  setScreenControl(
    computer: ComputerRef,
    interactive: boolean,
    context: AdapterContext,
    controlToken?: string,
  ) {
    return (
      this.route(computer).setScreenControl?.(computer, interactive, context, controlToken) ??
      Promise.resolve()
    );
  }

  stop(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).stop(computer, context);
  }

  destroy(computer: ComputerRef, context: AdapterContext) {
    return this.route(computer).destroy(computer, context);
  }
}
