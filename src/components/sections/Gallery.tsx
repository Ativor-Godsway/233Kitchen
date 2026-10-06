import { SITE } from '../../content/site';
import { srcSetFor } from '../../lib/images';
import { SectionHeading } from './SectionHeading';

export function Gallery() {
  return (
    <section className="overflow-hidden bg-ink py-24 sm:py-28" aria-label="Gallery">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="From the kitchen"
          title="Real boxes, real portions."
          sub="Every photo is a box we packed for a customer."
        />
      </div>
      <ul
        className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:gap-6 sm:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] [scrollbar-width:none]"
        tabIndex={0}
        aria-label="Food photos, scroll horizontally"
      >
        {SITE.gallery.map((g) => (
          <li key={g.src} className="w-[72vw] shrink-0 snap-center sm:w-[340px]">
            <figure>
              <div className="aspect-[3/4] overflow-hidden rounded-3xl bg-ink-700 ring-1 ring-white/10">
                <img
                  src={g.src}
                  srcSet={srcSetFor(g.src)}
                  sizes="(min-width: 640px) 340px, 72vw"
                  alt={g.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 hover:scale-105"
                />
              </div>
              <figcaption className="mt-3 text-sm font-medium text-cream/70">
                {g.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
