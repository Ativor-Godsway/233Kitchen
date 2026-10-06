import { Link } from 'react-router-dom';
import { KenteBand } from '../components/KenteBand';

export default function NotFound() {
  return (
    <section className="grid min-h-[80vh] place-items-center px-4 pt-16 text-center">
      <div>
        <p className="font-display text-[clamp(5rem,20vw,10rem)] font-semibold leading-none">
          <span className="text-ghana-red">4</span>
          <span className="text-ghana-gold">0</span>
          <span className="text-ghana-green-300">4</span>
        </p>
        <KenteBand height={6} className="mx-auto mt-4 max-w-[200px] rounded-full" />
        <h1 className="mt-6 font-display text-3xl font-semibold">This page isn’t on the menu.</h1>
        <p className="mt-2 text-cream/60">The link may be old, or the page has moved.</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-full bg-cream px-6 py-3 font-semibold text-ink hover:bg-white"
        >
          Back to the kitchen
        </Link>
      </div>
    </section>
  );
}
