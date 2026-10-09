import { Navigation, Phone } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../../shared/constants';
import { mapLinks, streetLine } from '../../../shared/maps';
import { usePublicConfig } from '../../lib/queries';
import { BrandIcon } from '../BrandIcon';
import { SectionHeading } from './SectionHeading';

const WEEKDAYS = [
  '',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
  'Sundays',
];

/** Embedded Google Map (lazy) + Get directions / Apple Maps. Location comes from Settings → mapQuery. */
function LocationMap({ query }: { query: string }) {
  const links = mapLinks(query);
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_20px_40px_-24px_rgba(0,0,0,.35)] ring-1 ring-ink/10">
      <div className="relative h-72 bg-cream-300 sm:h-80 lg:h-[420px]">
        <iframe
          key={links.embed}
          src={links.embed}
          title={`Google Map of the pickup area: ${query}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{query}</p>
          <p className="text-sm text-ink/65">Pickup only. We’ll meet you at the curb.</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <a
            href={links.search}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ghana-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-ghana-red/25 transition hover:bg-ghana-red-400"
          >
            <Navigation size={16} aria-hidden /> Get directions
            <span className="sr-only">(opens Google Maps in a new tab)</span>
          </a>
          <a
            href={links.apple}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-xs font-medium text-ink/70 underline-offset-2 hover:text-ink hover:underline"
          >
            Open in Apple Maps<span className="sr-only"> (new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function Pickup() {
  const { data } = usePublicConfig();
  const s = data?.settings ?? DEFAULT_SETTINGS;
  const days = s.pickupDays.map((d) => WEEKDAYS[d]).join(' & ');
  const tel = s.businessPhone.replace(/\D/g, '');

  return (
    <section id="pickup" className="scroll-mt-16 bg-cream-200 py-24 text-ink sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionHeading
            tone="light"
            eyebrow="Pickup & location"
            title={`Pick up ${days}.`}
            sub="Choose a time window at checkout. We’ll have your box ready."
          />
          <ul className="mt-8 space-y-5">
            <li className="flex gap-4">
              <BrandIcon name="location" tone="ink" size={20} />
              <div>
                <p className="font-semibold">{s.pickupAddressPublic}</p>
                <p className="text-sm text-ink/65">
                  Meet us at the curb outside {streetLine(s.pickupAddressPublic)}.
                </p>
                <a
                  href={mapLinks(s.mapQuery || s.pickupAddressPublic).search}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ghana-red hover:underline"
                >
                  <Navigation size={14} aria-hidden /> Get directions
                  <span className="sr-only">(opens Google Maps in a new tab)</span>
                </a>
              </div>
            </li>
            <li className="flex gap-4">
              <BrandIcon name="time" tone="ink" size={20} />
              <div>
                <p className="font-semibold">Pickup windows</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {s.windows.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-full bg-white px-3 py-1 text-sm font-medium ring-1 ring-ink/10"
                    >
                      {w.label}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
            <li className="flex gap-4">
              <BrandIcon name="courier" tone="ink" size={20} />
              <div>
                <p className="font-semibold">Prefer delivery?</p>
                <p className="text-sm text-ink/65">
                  Send an Uber courier to collect your order. Just choose that option at checkout.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <BrandIcon name="phone" tone="ink" size={20} />
              <div>
                <p className="font-semibold">Questions?</p>
                <a
                  href={`tel:+1${tel}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-ghana-red hover:underline"
                >
                  <Phone size={14} aria-hidden /> Call or text {s.businessPhone}
                </a>
              </div>
            </li>
          </ul>
        </div>
        <LocationMap query={s.mapQuery || s.pickupAddressPublic} />
      </div>
    </section>
  );
}
