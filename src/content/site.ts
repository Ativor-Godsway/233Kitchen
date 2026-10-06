/**
 * Marketing copy for the public site — edit words here, not in components.
 * Business settings (phone, address, payment text, windows) live in admin → Settings.
 */
export const SITE = {
  /** Main hero headline. Alternatives are listed in OPEN_QUESTIONS.md. */
  headline: ['Ghana,', 'boxed with love.'],
  eyebrow: 'Ghanaian home kitchen · Worcester, MA',
  subline: 'Pre-order from the menu. Pick up fresh every Wednesday in Worcester.',
  heroStory: {
    title: 'Cooked to order. Never sitting under a heat lamp.',
    body: 'Every box is made fresh for the people who ordered it. That’s why we cook once a week.',
  },
  howItWorks: [
    {
      icon: 'preorder',
      title: 'Pre-order',
      body: 'Build your box online and choose a Wednesday pickup time. No payment needed to order.',
    },
    {
      icon: 'cook',
      title: 'We cook fresh',
      body: 'Everything is cooked to order in small batches, just for the week’s orders.',
    },
    {
      icon: 'pickup',
      title: 'Pick up Wednesday',
      body: 'Collect in Worcester during your time window, or send an Uber courier for it.',
    },
  ],
  gallery: [
    {
      src: '/images/fried-rice-chicken-960.webp',
      alt: 'Fried rice with grilled chicken, plantain, coleslaw and shito',
      caption: 'Loaded fried rice',
    },
    {
      src: '/images/banku-tilapia-960.webp',
      alt: 'Grilled tilapia topped with peppers and red cabbage, with pepper sauce and shito',
      caption: 'Banku & grilled tilapia',
    },
    {
      src: '/images/waakye-meat-960.webp',
      alt: 'Waakye with red stew, gari, boiled eggs, plantain and coleslaw',
      caption: 'Hajia waakye',
    },
    {
      src: '/images/waakye-fish-960.webp',
      alt: 'Waakye with talia, stew, gari, egg, plantain and fried fish',
      caption: 'Waakye with fish',
    },
    {
      src: '/images/rice-platter-960.webp',
      alt: 'Rice platter with omelette, sausages, plantain and pepper sauce',
      caption: 'From our kitchen',
    },
  ],
  faq: [
    {
      q: 'When do I need to order by?',
      a: 'Orders for each Wednesday close on the Monday before at 11:59 PM (Eastern). The exact cutoff is shown at checkout.',
    },
    {
      q: 'Do I pay online?',
      a: 'No. There’s no payment online. Place your order, we’ll confirm it, and the payment options are in your confirmation email.',
    },
    {
      q: 'Can I get it delivered?',
      a: 'We’re pickup only, but you’re welcome to send an Uber courier. Choose “I’ll send an Uber courier” at checkout.',
    },
    {
      q: 'Can I change or cancel my order?',
      a: 'Of course. Call or text us before the cutoff and we’ll sort it out.',
    },
    {
      q: 'Allergies or spice level?',
      a: 'Add a note to any dish or your order. Our shito and pepper sauce come on the side, so you control the heat.',
    },
  ],
} as const;
