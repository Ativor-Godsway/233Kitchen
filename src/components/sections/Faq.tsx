import { ChevronDown } from 'lucide-react';
import { SITE } from '../../content/site';
import { SectionHeading } from './SectionHeading';

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 bg-cream py-24 text-ink sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          tone="light"
          align="center"
          eyebrow="Good to know"
          title="Questions, answered."
        />
        <div className="mt-10 divide-y divide-ink/10 rounded-3xl bg-white ring-1 ring-ink/5">
          {SITE.faq.map((f) => (
            <details
              key={f.q}
              className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <ChevronDown
                  size={18}
                  className="shrink-0 transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
