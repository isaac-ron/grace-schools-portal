"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import {
  SubmitButton,
  ConfirmSubmit,
  SelectInput,
  type ActionState,
} from "@/components/form";
import { setClassTeacher, assignSubjectTeacher, removeSubjectTeacher } from "../actions";

type Opt = { value: string; label: string };

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

const err = (s: ActionState, f: string) => s?.fieldErrors?.[f]?.[0];

export function ClassTeacherForm({
  classId,
  current,
  teachers,
}: {
  classId: string;
  current: string | null;
  teachers: Opt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(setClassTeacher, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="class_id" value={classId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Class teacher"
          name="class_teacher_id"
          defaultValue={current ?? ""}
          options={teachers}
          placeholder={teachers.length ? "Nobody assigned" : "No active teachers"}
          error={err(state, "class_teacher_id")}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Saving...">Save class teacher</SubmitButton>
      </div>
    </form>
  );
}

export function AssignSubjectForm({
  classId,
  teachers,
  subjects,
}: {
  classId: string;
  teachers: Opt[];
  subjects: Opt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(assignSubjectTeacher, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">Assign a subject teacher</h3>
      <Feedback state={state} />
      <input type="hidden" name="class_id" value={classId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Teacher"
          name="staff_id"
          options={teachers}
          placeholder="Choose"
          error={err(state, "staff_id")}
          required
        />
        <SelectInput
          label="Learning area"
          name="subject_id"
          options={subjects}
          placeholder="Choose"
          error={err(state, "subject_id")}
          required
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Assigning...">Assign</SubmitButton>
      </div>
    </form>
  );
}

export function RemoveAssignment({
  assignmentId,
  classId,
}: {
  assignmentId: string;
  classId: string;
}) {
  const [, action] = useActionState<ActionState, FormData>(removeSubjectTeacher, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="class_id" value={classId} />
      <ConfirmSubmit
        confirm="Remove this assignment? The teacher will immediately lose access to this class."
        pendingLabel="Removing..."
      >
        Remove
      </ConfirmSubmit>
    </form>
  );
}
