"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import {
  SubmitButton,
  ConfirmSubmit,
  TextInput,
  SelectInput,
  type ActionState,
} from "@/components/form";
import {
  createStudent,
  updateStudent,
  setStudentActive,
  moveStudentClass,
  linkGuardian,
  unlinkGuardian,
} from "./actions";

type Opt = { value: string; label: string };

type Student = {
  id: string;
  admission_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  is_active: boolean;
};

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

const err = (s: ActionState, f: string) => s?.fieldErrors?.[f]?.[0];

const GENDERS: Opt[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

function NameFields({ state, student }: { state: ActionState; student?: Student }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Admission number"
          name="admission_no"
          defaultValue={student?.admission_no}
          placeholder="GS/2026/001"
          error={err(state, "admission_no")}
          required
        />
        <TextInput
          label="Date of birth"
          name="date_of_birth"
          type="date"
          defaultValue={student?.date_of_birth ?? ""}
          error={err(state, "date_of_birth")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput
          label="First name"
          name="first_name"
          defaultValue={student?.first_name}
          error={err(state, "first_name")}
          required
        />
        <TextInput
          label="Middle name"
          name="middle_name"
          defaultValue={student?.middle_name ?? ""}
          error={err(state, "middle_name")}
        />
        <TextInput
          label="Last name"
          name="last_name"
          defaultValue={student?.last_name}
          error={err(state, "last_name")}
          required
        />
      </div>
    </>
  );
}

export function NewStudentForm({ classes }: { classes: Opt[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createStudent, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Feedback state={state} />
      <NameFields state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Gender"
          name="gender"
          options={GENDERS}
          placeholder="Not recorded"
          error={err(state, "gender")}
        />
        <SelectInput
          label="Class"
          name="class_id"
          options={classes}
          placeholder={classes.length ? "Choose" : "No classes for the current year"}
          hint="A learner sits in one class per year."
          error={err(state, "class_id")}
          required
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Enrolling...">Enrol learner</SubmitButton>
      </div>
    </form>
  );
}

export function EditStudentForm({ student }: { student: Student }) {
  const [state, action] = useActionState<ActionState, FormData>(updateStudent, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Feedback state={state} />
      <input type="hidden" name="id" value={student.id} />
      <NameFields state={state} student={student} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Gender"
          name="gender"
          defaultValue={student.gender ?? ""}
          options={GENDERS}
          placeholder="Not recorded"
          error={err(state, "gender")}
        />
      </div>
      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function MoveClassForm({
  studentId,
  currentClassId,
  classes,
}: {
  studentId: string;
  currentClassId: string | null;
  classes: Opt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(moveStudentClass, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Class"
          name="class_id"
          defaultValue={currentClassId ?? ""}
          options={classes}
          placeholder="Choose"
          error={err(state, "class_id")}
          required
        />
      </div>
      <div>
        <SubmitButton variant="secondary" pendingLabel="Moving...">
          Move learner
        </SubmitButton>
      </div>
    </form>
  );
}

export function ArchiveToggle({ student }: { student: Student }) {
  const [state, action] = useActionState<ActionState, FormData>(setStudentActive, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={student.id} />
      <input type="hidden" name="is_active" value={student.is_active ? "false" : "true"} />
      {student.is_active ? (
        <ConfirmSubmit
          confirm="Archive this learner? Their marks, attendance and report cards are kept, and they disappear from active lists."
          pendingLabel="Archiving..."
        >
          Archive learner
        </ConfirmSubmit>
      ) : (
        <SubmitButton variant="secondary" pendingLabel="Restoring...">
          Restore learner
        </SubmitButton>
      )}
    </form>
  );
}

export function LinkGuardianForm({
  studentId,
  parents,
}: {
  studentId: string;
  parents: Opt[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(linkGuardian, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Link a guardian</h3>
      <Feedback state={state} />
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Parent account"
          name="guardian_id"
          options={parents}
          placeholder={parents.length ? "Choose" : "No parent accounts yet"}
          error={err(state, "guardian_id")}
          required
        />
        <SelectInput
          label="Relationship"
          name="relationship"
          options={[
            { value: "mother", label: "Mother" },
            { value: "father", label: "Father" },
            { value: "guardian", label: "Guardian" },
            { value: "other", label: "Other" },
          ]}
          defaultValue="guardian"
          error={err(state, "relationship")}
          required
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Linking...">Link guardian</SubmitButton>
      </div>
    </form>
  );
}

export function UnlinkGuardian({
  studentId,
  guardianId,
}: {
  studentId: string;
  guardianId: string;
}) {
  const [, action] = useActionState<ActionState, FormData>(unlinkGuardian, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="guardian_id" value={guardianId} />
      <ConfirmSubmit
        confirm="Unlink this guardian? They will immediately lose access to this learner's records."
        pendingLabel="Unlinking..."
      >
        Unlink
      </ConfirmSubmit>
    </form>
  );
}
