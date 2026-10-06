import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Logo } from '../Logo';
import { KenteBand } from '../KenteBand';
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '../SocialIcons';
import { usePublicConfig } from '../../lib/queries';
import { DEFAULT_SETTINGS } from '../../../shared/constants';

export function Footer() {
  const { data } = usePublicConfig();
  const s = data?.settings ?? DEFAULT_SETTINGS;
  const tel = s.businessPhone.replace(/\D/g, '');
  const socials = [
    { label: 'Instagram', href: s.social.instagram, Icon: InstagramIcon },
    { label: 'WhatsApp', href: s.social.whatsapp, Icon: WhatsAppIcon },
    { label: 'TikTok', href: s.social.tiktok, Icon: TikTokIcon },
    { label: 'Facebook', href: s.social.facebook, Icon: FacebookIcon },
  ];

  return (
    <footer className="bg-ink text-cream">
      <KenteBand height={10} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex items-start gap-4">
          <Logo size={64} />
          <div>
            <p className="font-display text-xl font-semibold">+233 Kitchen</p>
            <p className="mt-1 max-w-xs text-sm text-cream/60">
              Ghanaian home cooking, made to order in Worcester, MA. Pre-order online, pick up Wednesdays.
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/50">Contact</p>
          <a href={`tel:+1${tel}`} className="mt-3 inline-flex items-center gap-2 text-sm hover:text-ghana-gold">
            <Phone size={16} aria-hidden /> {s.businessPhone}
          </a>
          <p className="mt-2 text-sm text-cream/60">{s.pickupAddressPublic}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/50">Follow</p>
          <ul className="mt-3 flex gap-2">
            {socials.map(({ label, href, Icon }) => (
              <li key={label}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-white/15"
                    aria-label={label}
                  >
                    <Icon />
                  </a>
                ) : (
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-cream/30 ring-1 ring-white/5"
                    title={`${label} coming soon`}
                    aria-label={`${label} (coming soon)`}
                    role="img"
                  >
                    <Icon />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-cream/40 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} +233 Kitchen. Made with love in Worcester.</p>
          <Link to="/admin" className="hover:text-cream/70">
            Owner login
          </Link>
        </div>
      </div>
    </footer>
  );
}
