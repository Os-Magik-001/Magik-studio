"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { Field } from "@/components/field";
import { saveReferralReward } from "@/app/actions/referrals";

export function ReferralRewardForm({ reward }: { reward: number }) {
  return (
    <ActionForm action={saveReferralReward} className="flex flex-wrap items-end gap-3">
      <Field label="Credits for each signed referral">
        <Input name="reward" type="number" min={0} max={100000} step={1} defaultValue={reward} className="w-40" />
      </Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
    </ActionForm>
  );
}
