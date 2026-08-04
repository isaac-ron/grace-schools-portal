"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton, SelectInput, TextInput, type ActionState } from "@/components/form";
import { runPromotion } from "./actions";

export function PromotionForm({
  years,
  currentId,
}: {
  years: { value: string; label: string }[];
  currentId?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(runPromotion, undefined);
  const err = (f: string) => state?.fieldErrors?.[f]?.[0];

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Promote from"
          name="from_year"
          defaultValue={currentId ?? ""}
          options={years}
          placeholder="Choose"
          error={err("from_year")}
          required
        />
        <SelectInput
          label="Promote into"
          name="to_year"
          options={years}
          placeholder="Choose"
          error={err("to_year")}
          required
        />
      </div>

      {/* A typed confirmation rather than a dialog: this moves the whole school,
          and a misclick should not be enough to trigger it. */}
      <TextInput
        label="Type PROMOTE to confirm"
        name="confirm"
        placeholder="PROMOTE"
        autoComplete="off"
        hint="This moves every active learner up one grade."
        error={err("confirm")}
        required
      />

      <div>
        <SubmitButton variant="destructive" pendingLabel="Promoting...">
          Run promotion
        </SubmitButton>
      </div>
    </form>
  );
}
