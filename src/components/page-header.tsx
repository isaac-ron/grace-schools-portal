/**
 * The head of a page, closed by the gold rule that structures the Crest system.
 * Toolbar in `table.tsx` is the same head with an action slot; this is the plain
 * one, for pages that carry no page-level action.
 */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rule-gold mb-6 pb-4">
      <h1 className="font-display text-2xl text-balance text-ink">{title}</h1>
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
    <div className="border-y border-line bg-card px-6 py-12 text-center">
      <p className="font-display text-lg text-ink">{what}</p>
      <p className="mx-auto mt-1.5 max-w-prose text-sm text-ink-soft">
        Built in {phase}. The account system, permissions and database behind it
        are already in place.
      </p>
    </div>
  );
}
