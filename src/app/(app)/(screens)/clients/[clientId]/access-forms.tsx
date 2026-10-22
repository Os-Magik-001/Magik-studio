"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { Field } from "@/components/field";
import { setClientAccess } from "@/app/actions/studio";
import { saveClientWebsite } from "@/app/actions/website";

export function AccessActions({ clientId, hasSetup }: { clientId: string; hasSetup: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {!hasSetup && (
        <ActionForm action={setClientAccess}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="mode" value="setup" />
          <SubmitButton size="sm" variant="secondary" pendingText="…">
            Open their setup
          </SubmitButton>
        </ActionForm>
      )}
      <ActionForm action={setClientAccess}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="mode" value="done" />
        <SubmitButton size="sm" pendingText="…">
          Mark as onboarded
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export function WebsiteForm({ clientId, status, url, adminUrl }: { clientId: string; status: string; url: string; adminUrl: string }) {
  const [s, setS] = useState(status);
  return (
    <ActionForm action={saveClientWebsite} className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Their website with Magik">
        <Select name="status" value={s} onChange={(e) => setS(e.target.value)}>
          <option value="none">None yet</option>
          <option value="building">Being built</option>
          <option value="live">Live</option>
        </Select>
      </Field>
      {s !== "none" && (
        <>
          <Field label="Address" hint="https://…">
            <Input name="siteUrl" type="url" defaultValue={url} placeholder="https://www.theirbusiness.com" />
          </Field>
          <Field label="Where they edit it (optional)">
            <Input name="siteAdminUrl" type="url" defaultValue={adminUrl} placeholder="https://…/admin" />
          </Field>
        </>
      )}
      <SubmitButton size="sm" variant="secondary" className="self-start">
        Save
      </SubmitButton>
    </ActionForm>
  );
}
