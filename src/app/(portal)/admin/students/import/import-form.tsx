"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { previewImport, commitImport, type ImportState } from "./actions";

const TEMPLATE =
  "admission_no,first_name,middle_name,last_name,grade,stream,gender,date_of_birth\n" +
  "GS/2026/001,Faith,,Achieng,G7,,female,2013-04-12\n" +
  "GS/2026/002,Brian,Otieno,Achieng,G2,,male,2018-09-03\n";

function templateHref() {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
}

export function ImportForm() {
  const [state, action] = useActionState<ImportState, FormData>(previewImport, undefined);
  const [commitState, commitAction] = useActionState<ImportState, FormData>(
    commitImport,
    undefined,
  );

  const done = Boolean(commitState?.ok);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">
          The file needs these columns:{" "}
          <code className="rounded bg-surface-dark px-1.5 py-0.5 text-[0.8125rem]">
            admission_no, first_name, last_name, grade
          </code>
          . Optional:{" "}
          <code className="rounded bg-surface-dark px-1.5 py-0.5 text-[0.8125rem]">
            middle_name, stream, gender, date_of_birth
          </code>
          . Grade uses the codes PP1, PP2, G1 to G9.
        </p>
        <div>
          <a
            href={templateHref()}
            download="grace-learners-template.csv"
            className="text-sm font-semibold text-crimson underline underline-offset-4"
          >
            Download a template
          </a>
        </div>
      </div>

      {!done && (
        <form action={action} className="flex flex-col gap-4">
          {state?.error && <Alert tone="error">{state.error}</Alert>}
          {state?.ok && <Alert tone="success">{state.ok}</Alert>}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="file" className="text-sm font-semibold text-ink">
              Spreadsheet (.csv)
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="min-h-[44px] rounded-lg border border-line-strong bg-white
                         px-3.5 py-2.5 text-base file:mr-3 file:rounded-md file:border-0
                         file:bg-surface-dark file:px-3 file:py-2
                         file:text-sm file:font-semibold
                         focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-crimson"
            />
          </div>

          <div>
            <SubmitButton variant="secondary" pendingLabel="Checking...">
              Check the file
            </SubmitButton>
          </div>
        </form>
      )}

      {commitState?.error && <Alert tone="error">{commitState.error}</Alert>}
      {commitState?.ok && <Alert tone="success">{commitState.ok}</Alert>}

      {state?.preview && !done && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink">
            What will happen ({state.preview.length} rows checked, nothing saved yet)
          </h3>

          <TableWrap>
            <thead>
              <tr>
                <Th align="right">Line</Th>
                <Th>Admission no.</Th>
                <Th>Name</Th>
                <Th>Grade</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {state.preview.map((r) => (
                <Tr key={r.line}>
                  <Td align="right" numeric muted>
                    {r.line}
                  </Td>
                  <Td numeric>{r.admission_no || "-"}</Td>
                  <Td>{r.name || "-"}</Td>
                  <Td muted>{r.grade || "-"}</Td>
                  <Td>
                    {r.status === "ready" && <Pill tone="ok">Will import</Pill>}
                    {r.status === "duplicate" && <Pill tone="warn">{r.message}</Pill>}
                    {r.status === "error" && <Pill tone="alert">{r.message}</Pill>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>

          {(state.readyCount ?? 0) > 0 && (
            <form action={commitAction}>
              <input type="hidden" name="payload" value={state.payload} />
              <SubmitButton pendingLabel="Importing...">
                Import {state.readyCount} learner{state.readyCount === 1 ? "" : "s"}
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
