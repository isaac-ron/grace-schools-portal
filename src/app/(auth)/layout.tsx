import { Wordmark } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-surface">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Wordmark />
            {/* Gold as identity, never as an interactive colour. */}
            <span aria-hidden className="mt-4 block h-0.5 w-12 bg-gold" />
          </div>
          {children}
        </div>
      </div>

      <footer className="px-4 pb-8 text-center text-sm text-ink-soft">
        Chepilat Town, opposite Summit Hospital
        <br />
        <a
          href="tel:+254720970572"
          className="mt-1 inline-block min-h-[44px] py-2 font-medium text-crimson underline underline-offset-4"
        >
          0720 970 572
        </a>
      </footer>
    </main>
  );
}
