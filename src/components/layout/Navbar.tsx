import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { Logo } from '../Logo';
import { useCart, selectCount } from '../../store/cart';
import { useUi } from '../../store/ui';
import { cn } from '../../lib/cn';

const LINKS = [
  { href: '/#menu', label: 'Menu' },
  { href: '/#pickup', label: 'Pickup' },
];

export function Navbar() {
  const count = useCart(selectCount);
  const openBag = useUi((s) => s.openBag);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled || pathname !== '/'
          ? 'border-b border-white/10 bg-ink/70 backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
        aria-label="Main"
      >
        <Link
          to="/"
          className="flex items-center gap-3 rounded-full focus-visible:outline-offset-4"
          aria-label="+233 Kitchen home"
        >
          <Logo size={40} />
          <span className="hidden font-display text-lg font-semibold tracking-wide sm:inline">
            +233 Kitchen
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-cream/80 transition hover:bg-white/10 hover:text-cream"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="/#menu"
            className="rounded-full px-3 py-2 text-sm font-medium text-cream/80 hover:text-cream md:hidden"
          >
            Menu
          </a>
          <button
            type="button"
            onClick={openBag}
            className="relative flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
            aria-label={`Open bag, ${count} item${count === 1 ? '' : 's'}`}
          >
            <ShoppingBag size={18} aria-hidden />
            <span className="hidden sm:inline">Bag</span>
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="grid h-5 min-w-5 place-items-center rounded-full bg-ghana-red px-1 text-xs font-bold text-white"
                  aria-hidden
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>
    </header>
  );
}
