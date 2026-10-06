import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CartDrawer } from '../cart/CartDrawer';
import { ItemSheet } from '../menu/ItemSheet';

/** Public site chrome: navbar, footer, bag drawer and item sheet. */
export function SiteLayout() {
  const { pathname, hash } = useLocation();

  // Scroll to hash targets after navigation (e.g. /#menu from another page).
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }));
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="min-h-screen bg-ink text-cream">
      <a
        href="#main"
        className="sr-only z-[70] rounded bg-cream px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <ItemSheet />
    </div>
  );
}
