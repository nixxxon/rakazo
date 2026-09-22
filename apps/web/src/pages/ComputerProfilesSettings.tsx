import { Trans, useLingui } from "@lingui/react/macro";
import type { ComputerProfile, ComputerProfileKind } from "@rakazo/contracts";
import { Button, Input, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";

type ProfileSettings = {
  profiles: ComputerProfile[];
  availableKinds: ComputerProfileKind[];
  teamProfileId: string | null;
};

export function ComputerProfilesSettings() {
  const { t } = useLingui();
  const ids = useId();
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ComputerProfileKind | "">("");
  const [template, setTemplate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await rpc.computerProfiles.list();
    setSettings(next);
    setKind((current) => current || next.availableKinds[0] || "");
  }

  useEffect(() => {
    void refresh().catch((cause) => {
      setError(cause instanceof Error ? cause.message : t`Could not load computer profiles`);
    });
  }, [t]);

  async function createProfile() {
    if (!name.trim() || !kind || creating) return;
    setCreating(true);
    setError(null);
    try {
      await rpc.computerProfiles.create({
        name: name.trim(),
        kind,
        template: kind === "e2b" ? template.trim() || null : null,
      });
      setName("");
      setTemplate("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t`Could not create computer profile`);
    } finally {
      setCreating(false);
    }
  }

  async function setTeamProfile(profileId: string) {
    setError(null);
    try {
      const result = await rpc.computerProfiles.setTeam({ profileId: profileId || null });
      setSettings((current) =>
        current ? { ...current, teamProfileId: result.teamProfileId } : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t`Could not switch computer profile`);
    }
  }

  async function removeProfile(profile: ComputerProfile) {
    setError(null);
    try {
      await rpc.computerProfiles.remove({ profileId: profile.id });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t`Could not delete computer profile`);
    }
  }

  return (
    <div data-testid="computer-profiles-settings" className="space-y-5">
      <section className="rounded-xl border border-border px-4 py-4">
        <h3 className="text-[15px] font-medium text-foreground">
          <Trans>Team computer</Trans>
        </h3>
        <label
          htmlFor={`${ids}-team-profile`}
          className="mt-3 block text-[13px] text-muted-foreground"
        >
          <Trans>Profile</Trans>
          <NativeSelect
            id={`${ids}-team-profile`}
            data-testid="team-computer-profile"
            className="mt-2 w-full"
            value={settings?.teamProfileId ?? ""}
            disabled={!settings}
            onChange={(event) => void setTeamProfile(event.target.value)}
          >
            <NativeSelectOption value="">
              <Trans>Deployment default</Trans>
            </NativeSelectOption>
            {settings?.profiles.map((profile) => (
              <NativeSelectOption key={profile.id} value={profile.id}>
                {profile.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </section>

      <section className="rounded-xl border border-border px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-foreground">
            <Trans>Computer profiles</Trans>
          </h3>
          <span className="text-[12px] text-muted-foreground">
            {settings?.profiles.length ?? 0}
          </span>
        </div>
        <div className="mt-3 divide-y divide-border">
          {settings?.profiles.map((profile) => (
            <div key={profile.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-foreground">
                  {profile.name}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {profile.kind}
                  {profile.template ? ` · ${profile.template}` : ""}
                  {profile.computerCount
                    ? ` · ${profile.computerCount} ${profile.computerCount === 1 ? t`computer` : t`computers`}`
                    : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={profile.computerCount > 0}
                aria-label={t`Delete ${profile.name}`}
                title={
                  profile.computerCount > 0
                    ? t`Move computers to another profile first`
                    : t`Delete profile`
                }
                onClick={() => void removeProfile(profile)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          {settings && settings.profiles.length === 0 ? (
            <p className="py-2 text-[13px] text-muted-foreground">
              <Trans>No custom profiles yet.</Trans>
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border px-4 py-4">
        <h3 className="text-[15px] font-medium text-foreground">
          <Trans>New profile</Trans>
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label htmlFor={`${ids}-profile-name`} className="text-[13px] text-muted-foreground">
            <Trans>Name</Trans>
            <Input
              id={`${ids}-profile-name`}
              className="mt-1.5"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor={`${ids}-profile-provider`} className="text-[13px] text-muted-foreground">
            <Trans>Provider</Trans>
            <NativeSelect
              id={`${ids}-profile-provider`}
              className="mt-1.5 w-full"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as ComputerProfileKind);
                setTemplate("");
              }}
            >
              {settings?.availableKinds.map((availableKind) => (
                <NativeSelectOption key={availableKind} value={availableKind}>
                  {availableKind}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>
        {kind === "e2b" ? (
          <label
            htmlFor={`${ids}-profile-template`}
            className="mt-3 block text-[13px] text-muted-foreground"
          >
            <Trans>Template ID</Trans>
            <Input
              id={`${ids}-profile-template`}
              className="mt-1.5"
              value={template}
              maxLength={200}
              placeholder="desktop"
              onChange={(event) => setTemplate(event.target.value)}
            />
          </label>
        ) : null}
        <Button
          className="mt-4"
          disabled={!name.trim() || !kind || creating}
          onClick={() => void createProfile()}
        >
          <Plus size={15} />
          {creating ? <Trans>Creating…</Trans> : <Trans>Create profile</Trans>}
        </Button>
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
