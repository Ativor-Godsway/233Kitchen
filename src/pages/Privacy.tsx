import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../lib/queries';
import { DEFAULT_SETTINGS } from '../../shared/constants';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-cream/75">{children}</div>
    </section>
  );
}

export default function Privacy() {
  const { data } = usePublicConfig();
  const phone = data?.settings.businessPhone ?? DEFAULT_SETTINGS.businessPhone;
  const tel = `tel:+1${phone.replace(/\D/g, '').slice(-10)}`;

  useEffect(() => {
    document.title = 'Privacy · +233 Kitchen';
  }, []);

  return (
    <article className="mx-auto max-w-2xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ghana-gold">Privacy</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Your information, kept simple
      </h1>
      <p className="mt-4 text-lg text-cream/75">
        +233 Kitchen is a small home kitchen in Worcester, MA. We only ask for what we need to cook
        your order and get it to you.
      </p>

      <Section title="What we collect">
        <p>When you place a pre-order we keep:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>your name, phone number and email address;</li>
          <li>
            your order: the dishes and options you chose, your notes, the pickup day and time, and
            how you’ll collect it;
          </li>
          <li>whether you asked to receive our emails, and when.</li>
        </ul>
        <p>We don’t take payment online, so we never see your card or bank details.</p>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>to prepare your order and have it ready at the right time;</li>
          <li>
            to email you about your order (received, confirmed, ready) and to call or text you if
            something changes;
          </li>
          <li>to keep simple records of our orders.</li>
        </ul>
        <p>
          We don’t sell or share your details with anyone for their marketing. Our website host,
          database and email provider store them for us only to run this service.
        </p>
      </Section>

      <Section title="Marketing emails, only if you say yes">
        <p>
          We only send news about new dishes and offers if you tick “Email me about new menu items
          and offers” at checkout. Leaving it unticked never affects your order.
        </p>
        <p>
          To stop them, click <strong>Unsubscribe</strong> at the bottom of any of our marketing
          emails, or call or text us. Emails about an order you placed will still arrive.
        </p>
      </Section>

      <Section title="Questions or changes">
        <p>
          To see, correct or delete the details we hold about you, or for any question about this
          page, call or text{' '}
          <a href={tel} className="font-semibold text-cream underline underline-offset-4">
            {phone}
          </a>
          .
        </p>
      </Section>

      <p className="mt-12 text-sm text-cream/60">Last updated October 2026.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-cream px-6 py-3 font-semibold text-ink hover:bg-white"
      >
        Back to the menu
      </Link>
    </article>
  );
}
