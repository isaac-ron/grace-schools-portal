"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton, TextInput, SelectInput, type ActionState } from "@/components/form";
import { createClass, createSubject } from "./actions";

type Opt = { value: string; label: string };

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

const err = (s: ActionState, f: string) => s?.fieldErrors?.[f]?.[0];

export function ClassForm({
  yearId,
  grades,
  teachers,
}: {
  yearId: string;
  grades: Opt[];
  teachers: Opt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(createClass, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">Add a class</h3>
      <Feedback state={state} />
      <input type="hidden" name="academic_year_id" value={yearId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectInput
          label="Grade"
          name="grade_code"
          options={grades}
          placeholder="Choose"
          error={err(state, "grade_code")}
          required
        />
        <TextInput
          label="Stream"
          name="stream"
          placeholder="East"
          hint="Leave blank if the grade has one class."
          error={err(state, "stream")}
        />
        <SelectInput
          label="Class teacher"
          name="class_teacher_id"
          options={teachers}
          placeholder={teachers.length ? "Choose (optional)" : "No teachers yet"}
          error={err(state, "class_teacher_id")}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Creating...">Create class</SubmitButton>
      </div>
    </form>
  );
}

export function SubjectForm() {
  const [state, action] = useActionState<ActionState, FormData>(createSubject, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">Add a learning area</h3>
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput
          label="Code"
          name="code"
          placeholder="MATH"
          hint="Short, used on mark sheets."
          error={err(state, "code")}
          required
        />
        <TextInput
          label="Name"
          name="name"
          placeholder="Mathematics"
          error={err(state, "name")}
          required
        />
        <TextInput
          label="Order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={0}
          hint="Position on the report card."
          error={err(state, "sort_order")}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Adding...">Add learning area</SubmitButton>
      </div>
    </form>
  );
}
