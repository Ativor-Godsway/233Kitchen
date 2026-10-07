import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { GALLERY } from '../../content/gallery';
import { SectionHeading } from './SectionHeading';
import { cn } from '../../lib/cn';

const AUTOPLAY_MS = 3000;
/** Autoplay resumes this long after the last manual interaction. */
const IDLE_RESUME_MS = 4000;
/** Copies of the photo set rendered back to back, so looping is seamless at any width. */
const COPIES = 3;

/**
 * "Real boxes, real portions." auto-playing, looping photo carousel.
 * - Native horizontal scroll (touch swipe, trackpad) + mouse drag + prev/next buttons + arrow keys.
 * - Autoplay every 3s; pauses on hover, focus, touch/drag/wheel (resumes after 4s idle),
 *   when the tab is hidden or the carousel is off-screen, and via the pause button.
 * - prefers-reduced-motion: no autoplay and no smooth scrolling (manual only).
 * Photos come from src/assets/gallery/ (see src/content/gallery.ts).
 */
export function Gallery() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const lastInteraction = useRef(0);
  const drag = useRef<{ x: number; left: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const n = GALLERY.length;
  const loop = n > 1;
  const autoplayOn = loop && !reduce && !userPaused;

  /** Width of one full copy of the set, and the distance between neighbouring slides. */
  const measure = useCallback(() => {
    const el = trackRef.current;
    const items = el?.children;
    if (!el || !items || items.length < n + 1) return null;
    const first = items[0] as HTMLElement;
    const firstClone = items[n] as HTMLElement;
    const second = items[1] as HTMLElement;
    return {
      set: firstClone.offsetLeft - first.offsetLeft,
      step: second.offsetLeft - first.offsetLeft,
    };
  }, [n]);

  /** Instantly moves the scroll position by `delta` without snapping or animating. */
  const jump = useCallback((delta: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.scrollSnapType = 'none';
    el.style.scrollBehavior = 'auto';
    el.scrollLeft += delta;
    requestAnimationFrame(() => {
      el.style.scrollSnapType = '';
      el.style.scrollBehavior = '';
    });
  }, []);

  /** Keep the view inside the middle copy so there is always room to scroll both ways. */
  const normalize = useCallback(() => {
    const el = trackRef.current;
    const m = measure();
    if (!el || !m || !loop || drag.current) return;
    if (el.scrollLeft >= m.set * 2 - 1) jump(-m.set);
    else if (el.scrollLeft < m.set - 1) jump(m.set);
  }, [jump, loop, measure]);

  // Start in the middle copy.
  useLayoutEffect(() => {
    const m = measure();
    if (m && loop && trackRef.current) jump(m.set);
  }, [jump, loop, measure]);

  // Normalise once scrolling settles (scrollend where supported, debounce otherwise).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !loop) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(normalize, 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', normalize);
    const ro = new ResizeObserver(() => normalize());
    ro.observe(el);
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', normalize);
      ro.disconnect();
    };
  }, [loop, normalize]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const el = trackRef.current;
      const m = measure();
      if (!el || !m) return;
      normalize();
      el.scrollBy({ left: dir * m.step, behavior: reduce ? 'auto' : 'smooth' });
    },
    [measure, normalize, reduce],
  );

  const markInteraction = () => {
    lastInteraction.current = Date.now();
  };

  // Pause when the tab is hidden or the carousel is off-screen.
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
    };
  }, []);

  // Autoplay tick.
  useEffect(() => {
    if (!autoplayOn || hovering || focused || dragging || !inView || !pageVisible) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastInteraction.current < IDLE_RESUME_MS) return;
      go(1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [autoplayOn, hovering, focused, dragging, inView, pageVisible, go]);

  // Mouse drag (touch and trackpads use native scrolling).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    markInteraction();
    if (e.pointerType !== 'mouse' || e.button !== 0 || !trackRef.current) return;
    drag.current = { x: e.clientX, left: trackRef.current.scrollLeft, id: e.pointerId };
    trackRef.current.setPointerCapture(e.pointerId);
    trackRef.current.style.scrollSnapType = 'none';
    trackRef.current.style.scrollBehavior = 'auto';
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !trackRef.current) return;
    trackRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const endDrag = () => {
    const el = trackRef.current;
    if (!drag.current || !el) return;
    const m = measure();
    drag.current = null;
    setDragging(false);
    markInteraction();
    // Settle on the nearest slide, then restore CSS snapping.
    if (m)
      el.scrollTo({
        left: Math.round(el.scrollLeft / m.step) * m.step,
        behavior: reduce ? 'auto' : 'smooth',
      });
    el.style.scrollSnapType = '';
    el.style.scrollBehavior = '';
  };

  if (n === 0) return null;
  const slides = loop
    ? Array.from({ length: COPIES }, (_, c) => GALLERY.map((p, i) => ({ p, i, c }))).flat()
    : GALLERY.map((p, i) => ({ p, i, c: 1 }));
  const playing = autoplayOn && !hovering && !focused && !dragging && inView && pageVisible;

  const btn =
    'grid h-11 w-11 place-items-center rounded-full bg-white/10 text-cream ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-gold';

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden bg-ink py-24 sm:py-28"
      aria-roledescription="carousel"
      aria-label="Food photos"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <SectionHeading
          eyebrow="From the kitchen"
          title="Real boxes, real portions."
          sub="Every photo is a box we packed for a customer."
        />
        {loop && (
          <div className="flex shrink-0 items-center gap-2">
            {!reduce && (
              <button
                type="button"
                className={btn}
                onClick={() => setUserPaused((v) => !v)}
                aria-pressed={userPaused}
                aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
              >
                {userPaused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
              </button>
            )}
            <button
              type="button"
              className={btn}
              onClick={() => {
                markInteraction();
                go(-1);
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => {
                markInteraction();
                go(1);
              }}
              aria-label="Next photo"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        role="group"
        tabIndex={0}
        aria-label="Food photos, scroll horizontally or use the arrow keys"
        aria-live={playing ? 'off' : 'polite'}
        className={cn(
          'mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden',
          'scroll-pl-4 sm:scroll-pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] sm:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ghana-gold',
          !reduce && 'scroll-smooth',
          dragging ? 'cursor-grabbing select-none' : 'cursor-grab',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={markInteraction}
        onTouchStart={markInteraction}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            markInteraction();
            go(e.key === 'ArrowRight' ? 1 : -1);
          }
        }}
      >
        {slides.map(({ p, i, c }) => {
          const clone = c !== 1;
          return (
            <div
              key={`${c}-${p.key}`}
              className="w-[72vw] shrink-0 snap-start sm:w-[340px]"
              {...(clone
                ? { 'aria-hidden': true }
                : {
                    role: 'group',
                    'aria-roledescription': 'slide',
                    'aria-label': `${i + 1} of ${n}: ${p.caption}`,
                  })}
            >
              <figure>
                <div className="aspect-[3/4] overflow-hidden rounded-3xl bg-ink-700 ring-1 ring-white/10">
                  <img
                    src={p.src}
                    srcSet={p.srcSet}
                    sizes="(min-width: 640px) 340px, 72vw"
                    alt={clone ? '' : p.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover transition duration-700 hover:scale-105"
                  />
                </div>
                <figcaption className="mt-3 text-sm font-medium text-cream/70">
                  {p.caption}
                </figcaption>
              </figure>
            </div>
          );
        })}
      </div>
    </section>
  );
}
