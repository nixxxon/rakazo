import { RPCHandler } from "@orpc/server/fetch";
import type { SandboxProvider } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createRouter, type RouterDeps } from "./router.js";

const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "owner@rakazo.test",
  isDeploymentOwner: true,
} satisfies Actor;

async function call(
  deps: RouterDeps,
  path: string,
  body: unknown = undefined,
  requestActor: Actor = actor,
) {
  const handler = new RPCHandler(createRouter(deps));
  const { response } = await handler.handle(
    new Request(`http://127.0.0.1/rpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: body }),
    }),
    { prefix: "/rpc", context: { actor: requestActor } },
  );
  return response;
}

function depsWith(prisma: unknown, sandbox: Partial<SandboxProvider> = {}) {
  return {
    prisma: prisma as PrismaClient,
    sandbox: sandbox as SandboxProvider,
    env: {
      sandboxProvider: "docker",
      sandboxSupervisorToken: "docker-token",
      e2bApiKey: "e2b-key",
    },
  } as unknown as RouterDeps;
}

describe("computer profiles", () => {
  it("lists Space-scoped profiles and configured providers", async () => {
    const now = new Date("2026-09-22T10:00:00.000Z");
    const deps = depsWith({
      computerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "profile-1",
            name: "Powerful E2B",
            kind: "e2b",
            template: "gpu-large",
            createdAt: now,
            updatedAt: now,
            _count: { computers: 1 },
          },
        ]),
      },
      computer: { findUnique: vi.fn().mockResolvedValue({ profileId: "profile-1" }) },
    });

    const response = await call(deps, "computerProfiles/list");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      json: {
        profiles: [
          expect.objectContaining({
            id: "profile-1",
            kind: "e2b",
            template: "gpu-large",
            computerCount: 1,
          }),
        ],
        availableKinds: ["docker", "e2b"],
        teamProfileId: "profile-1",
      },
    });
  });

  it("creates an immutable provider and template selection", async () => {
    const now = new Date("2026-09-22T10:00:00.000Z");
    const create = vi.fn().mockResolvedValue({
      id: "profile-1",
      name: "Powerful E2B",
      kind: "e2b",
      template: "gpu-large",
      createdAt: now,
      updatedAt: now,
      _count: { computers: 0 },
    });
    const response = await call(
      depsWith({ computerProfile: { create } }),
      "computerProfiles/create",
      { name: "Powerful E2B", kind: "e2b", template: "gpu-large" },
    );

    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ spaceId: "space-1", kind: "e2b", template: "gpu-large" }),
      }),
    );
  });

  it("allows only the deployment owner to create profiles", async () => {
    const create = vi.fn();
    const response = await call(
      depsWith({ computerProfile: { create } }),
      "computerProfiles/create",
      { name: "Powerful E2B", kind: "e2b", template: "gpu-large" },
      { ...actor, isDeploymentOwner: false },
    );

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not delete a profile while a computer uses it", async () => {
    const remove = vi.fn();
    const response = await call(
      depsWith({
        computerProfile: {
          findFirst: vi.fn().mockResolvedValue({
            id: "profile-1",
            spaceId: "space-1",
            _count: { computers: 1 },
          }),
          delete: remove,
        },
      }),
      "computerProfiles/remove",
      { profileId: "profile-1" },
    );

    expect(response.status).toBe(409);
    expect(remove).not.toHaveBeenCalled();
  });

  it("destroys stale provider state when the Team computer changes profile", async () => {
    const updatedAt = new Date("2026-09-22T10:00:00.000Z");
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const destroy = vi.fn().mockResolvedValue(undefined);
    const response = await call(
      depsWith(
        {
          computerProfile: {
            findFirst: vi.fn().mockResolvedValue({
              id: "profile-1",
              spaceId: "space-1",
              kind: "e2b",
              template: "gpu-large",
            }),
          },
          computer: {
            findUnique: vi.fn().mockResolvedValue({
              id: "computer-1",
              homeKey: "team-space-1",
              kind: "docker",
              template: null,
              profileId: null,
              providerRef: "old-sandbox",
              state: "stopped",
              controlHolder: "none",
              controlLeaseId: null,
              controlLeaseExpiresAt: null,
              updatedAt,
              maintenanceId: null,
              bots: [{ id: "bot-1" }],
            }),
            updateMany,
          },
          run: { findFirst: vi.fn().mockResolvedValue(null) },
          computerExecutionLease: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        },
        { destroy },
      ),
      "computerProfiles/setTeam",
      { profileId: "profile-1" },
    );

    expect(response.status).toBe(200);
    expect(destroy).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "old-sandbox", kind: "docker" }),
      expect.anything(),
    );
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: "profile-1",
          kind: "e2b",
          template: "gpu-large",
          providerRef: null,
          state: "stopped",
        }),
      }),
    );
  });
});
