import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, MailX } from 'lucide-react';
import { api, ApiError } from '../lib/api';

type State = 'idle' | 'working' | 'done' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = 'Unsubscribe · +233 Kitchen';
  }, []);

  const unsubscribe = async () => {
    setState('working');
    try {
      await api('/unsubscribe', { method: 'POST', json: { token } });
      setState('done');
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Something went wrong.');
      setState('error');
    }
  };

  return (
    <section className="grid min-h-[75vh] place-items-center px-4 pt-16 text-center">
      <div className="max-w-md">
        <MailX size={40} className="mx-auto text-ghana-gold" aria-hidden />
        {state === 'done' ? (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">You’re unsubscribed</h1>
            <p className="mt-2 text-cream/60">
              You won’t receive marketing emails from us. Order emails will still arrive when you
              order.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">
              Unsubscribe from +233 Kitchen emails?
            </h1>
            <p className="mt-2 text-cream/60">
              You’ll stop receiving news about new menu items and offers.
            </p>
            {!token && (
              <p className="mt-4 text-sm text-ghana-gold">
                This link is missing its token. Please use the link from your email.
              </p>
            )}
            {state === 'error' && (
              <p className="mt-4 text-sm text-ghana-red-300" role="alert">
                {message}
              </p>
            )}
            <button
              type="button"
              disabled={!token || state === 'working'}
              onClick={unsubscribe}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 font-semibold text-ink disabled:opacity-50"
            >
              {state === 'working' && <Loader2 size={18} className="animate-spin" aria-hidden />}{' '}
              Unsubscribe
            </button>
          </>
        )}
        <Link to="/" className="mt-4 block py-3 text-sm text-cream/60 hover:text-cream">
          Back to home
        </Link>
      </div>
    </section>
  );
}
