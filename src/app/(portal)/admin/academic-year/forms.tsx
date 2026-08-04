"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import {
  SubmitButton,
  TextInput,
  SelectInput,
  type ActionState,
} from "@/components/form";
import {
  createAcademicYear,
  createTerm,
  setCurrentYear,
  setCurrentTerm,
} from "./actions";

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

const err = (s: ActionState, f: string) => s?.fieldErrors?.[f]?.[0];

export function YearForm() {
  const [state, action] = useActionState<ActionState, FormData>(createAcademicYear, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Add an academic year</h3>
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput
          label="Name"
          name="name"
          placeholder="2027"
          hint="How the school refers to it."
          error={err(state, "name")}
          required
        />
        <TextInput
          label="First day"
          name="starts_on"
          type="date"
          error={err(state, "starts_on")}
          required
        />
        <TextInput
          label="Last day"
          name="ends_on"
          type="date"
          error={err(state, "ends_on")}
          required
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Creating...">Create year</SubmitButton>
      </div>
    </form>
  );
}

export function TermForm({ years }: { years: { value: string; label: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createTerm, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Add a term</h3>
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SelectInput
          label="Year"
          name="academic_year_id"
          options={years}
          placeholder="Choose"
          error={err(state, "academic_year_id")}
          required
        />
        <TextInput
          label="Name"
          name="name"
          placeholder="Term 1"
          error={err(state, "name")}
          required
        />
        <SelectInput
          label="Number"
          name="term_number"
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
          ]}
          placeholder="Choose"
          error={err(state, "term_number")}
          required
        />
        <TextInput
          label="First day"
          name="starts_on"
          type="date"
          error={err(state, "starts_on")}
          required
        />
        <TextInput
          label="Last day"
          name="ends_on"
          type="date"
          error={err(state, "ends_on")}
          required
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Creating...">Create term</SubmitButton>
      </div>
    </form>
  );
}

export function SetCurrentYear({ yearId, name }: { yearId: string; name: string }) {
  const [, action] = useActionState<ActionState, FormData>(setCurrentYear, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="year_id" value={yearId} />
      <SubmitButton variant="secondary" pendingLabel="Setting...">
        Make {name} current
      </SubmitButton>
    </form>
  );
}

export function SetCurrentTerm({ termId, name }: { termId: string; name: string }) {
  const [, action] = useActionState<ActionState, FormData>(setCurrentTerm, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="term_id" value={termId} />
      <SubmitButton variant="secondary" pendingLabel="Setting...">
        Make {name} current
      </SubmitButton>
    </form>
  );
}
