import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { formatMoney } from '../../shared/pricing';
import type { OrderDTO } from '../../shared/types';

const POLL_MS = 20_000;
const SOUND_KEY = 'k233-admin-sound';

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Short two-tone chime via Web Audio (no asset to load). */
function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* audio blocked until the user interacts — ignore */
  }
}

/**
 * Polls for orders created since the last check (every 20s, and on tab focus),
 * shows a toast + optional chime and refreshes order queries.
 */
export function useNewOrderAlerts(enabled: boolean) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const since = useRef<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [sound, setSoundState] = useState(readSound);

  const setSound = (on: boolean) => {
    setSoundState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (on) chime();
  };

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const tick = async () => {
      try {
        const qs = since.current ? `?since=${encodeURIComponent(since.current)}` : '';
        const res = await api<{ orders: OrderDTO[]; newCount: number; now: string }>(
          `/admin/orders/latest${qs}`,
        );
        if (stopped) return;
        setNewCount(res.newCount);
        if (since.current && res.orders.length) {
          for (const o of res.orders) {
            toast(`New order ${o.number}`, {
              description: `${o.customer.name} · ${formatMoney(o.total)} · ${o.pickupDateLabel}, ${o.pickupWindowLabel}`,
              duration: 15_000,
              action: { label: 'View', onClick: () => navigate(`/admin/orders?order=${o.id}`) },
            });
          }
          if (readSound()) chime();
          qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
          qc.invalidateQueries({ queryKey: ['admin', 'analytics'] });
          qc.invalidateQueries({ queryKey: ['admin', 'prep'] });
        }
        since.current = res.now;
      } catch {
        /* transient — try again next tick */
      }
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, qc, navigate]);

  useEffect(() => {
    document.title = newCount > 0 ? `(${newCount}) Admin · +233 Kitchen` : 'Admin · +233 Kitchen';
  }, [newCount]);

  return { newCount, sound, setSound };
}
