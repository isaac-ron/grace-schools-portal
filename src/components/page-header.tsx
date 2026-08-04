export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold text-balance text-ink">
        {title}
      </h1>
      {description && (
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * Marks a section whose route exists but whose feature lands in a later phase.
 * Better than a 404 while the shell is real and the surfaces are not.
 */
export function PhasePlaceholder({
  what,
  phase,
}: {
  what: string;
  phase: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-10 text-center">
      <p className="text-lg font-semibold text-ink">{what}</p>
      <p className="mx-auto mt-1.5 max-w-prose text-sm text-ink-soft">
        Built in {phase}. The account system, permissions and database behind it
        are already in place.
      </p>
    </div>
  );
}
