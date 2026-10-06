import { Phone } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../../shared/constants';
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

/** Lightweight stylised "map" (no third-party embed). */
function MapCard({ address }: { address: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink text-cream ring-1 ring-ink/10">
      <svg
        viewBox="0 0 400 300"
        className="h-64 w-full sm:h-full"
        aria-hidden
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="400" height="300" fill="#141414" />
        <g stroke="#2A2A2A" strokeWidth="10" strokeLinecap="round" fill="none">
          <path d="M-10 70 L410 40" />
          <path d="M-10 190 L410 230" />
          <path d="M80 -10 L120 310" />
          <path d="M300 -10 L260 310" />
        </g>
        <g stroke="#1E6131" strokeWidth="14" strokeLinecap="round" fill="none" opacity=".9">
          <path d="M-10 130 C 120 110, 260 160, 410 140" />
        </g>
        <g stroke="#202020" strokeWidth="4" fill="none">
          <path d="M-10 250 L410 270" />
          <path d="M190 -10 L200 310" />
          <path d="M350 -10 L340 310" />
        </g>
        <circle cx="210" cy="138" r="38" fill="#E1A10C" opacity=".14" />
        <circle cx="210" cy="138" r="22" fill="#E1A10C" opacity=".22" />
      </svg>
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-full">
        <div className="grid h-12 w-12 place-items-center rounded-full rounded-bl-none bg-ghana-red shadow-lg shadow-ghana-red/40 [transform:rotate(-45deg)]">
          <span className="h-3 w-3 rounded-full bg-white" />
        </div>
      </div>
      <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/10 p-4 backdrop-blur-md ring-1 ring-white/15">
        <p className="font-semibold">{address}</p>
        <p className="text-sm text-cream/70">Exact address is in your confirmation email.</p>
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
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
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
                  Street pickup in Worcester. Full address sent with your confirmation.
                </p>
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
        <MapCard address={s.pickupAddressPublic} />
      </div>
    </section>
  );
}
