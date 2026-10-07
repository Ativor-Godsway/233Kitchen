import { useRef } from 'react';
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SITE } from '../../content/site';
import { KenteBand } from '../KenteBand';
import { HeroVisual, HeroVisualStatic } from './HeroVisual';

const EASE = [0.22, 1, 0.36, 1] as const;

function Headline() {
  const reduce = useReducedMotion();
  return (
    <h1 className="font-display text-[clamp(2.9rem,11vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
      {SITE.headline.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className={
              i === SITE.headline.length - 1
                ? 'block bg-gradient-to-r from-cream via-ghana-gold-200 to-ghana-gold bg-clip-text text-transparent'
                : 'block'
            }
            initial={reduce ? false : { y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function Intro() {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE },
        };
  return (
    <>
      <motion.p
        {...fade(0)}
        className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-ghana-gold sm:text-sm"
      >
        {SITE.eyebrow}
      </motion.p>
      <Headline />
      <motion.p
        {...fade(0.45)}
        className="mx-auto mt-5 max-w-md text-base text-cream/70 sm:text-lg"
      >
        {SITE.subline}
      </motion.p>
      <motion.div {...fade(0.6)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#menu"
          className="inline-flex items-center gap-2 rounded-full bg-ghana-red px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-ghana-red/30 transition hover:bg-ghana-red-400"
        >
          Order now <ArrowRight size={18} aria-hidden />
        </a>
      </motion.div>
    </>
  );
}

/** Cinematic, scroll-driven hero. Falls back to a static layout for reduced motion. */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  const introOpacity = useTransform(scrollYProgress, [0, 0.26], [1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.26], ['0%', '-14%']);
  const introBlur = useTransform(scrollYProgress, [0, 0.26], [0, 6]);
  const introFilter = useMotionTemplate`blur(${introBlur}px)`;
  const introPointer = useTransform(introOpacity, (v) => (v < 0.2 ? 'none' : 'auto'));
  const storyOpacity = useTransform(scrollYProgress, [0.64, 0.8], [0, 1]);
  const storyY = useTransform(scrollYProgress, [0.64, 0.8], [36, 0]);

  if (reduce) {
    return (
      <section
        className="relative overflow-hidden bg-ink px-4 pb-20 pt-32 text-center"
        aria-label="Introduction"
      >
        <Intro />
        <HeroVisualStatic />
        <div className="mx-auto mt-14 max-w-xl">
          <p className="font-display text-2xl font-semibold">{SITE.heroStory.title}</p>
          <p className="mt-3 text-cream/70">{SITE.heroStory.body}</p>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative h-[250vh] bg-ink md:h-[270vh]" aria-label="Introduction">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 70% at 50% 0%, #1b1b1b 0%, #0B0B0B 60%)' }}
        />
        <HeroVisual progress={scrollYProgress} />

        <motion.div
          className="absolute inset-x-0 top-[13svh] z-10 px-4 text-center sm:top-[15svh]"
          style={{
            opacity: introOpacity,
            y: introY,
            filter: introFilter,
            pointerEvents: introPointer,
          }}
        >
          <Intro />
        </motion.div>

        <motion.div
          className="absolute inset-x-0 bottom-[6svh] z-10 mx-auto max-w-xl px-6 text-center"
          style={{ opacity: storyOpacity, y: storyY }}
        >
          <p className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
            {SITE.heroStory.title}
          </p>
          <p className="mt-2 text-sm text-cream/70 sm:text-base">{SITE.heroStory.body}</p>
          <KenteBand animate height={6} className="mx-auto mt-6 max-w-[220px] rounded-full" />
        </motion.div>
      </div>
    </section>
  );
}
