/**
 * Cups & Pups marketing promo — edit this file to change copy, prices, and WhatsApp.
 *
 * WHATSAPP_NUMBER: digits with country code (example: +961XXXXXXXX).
 * Strings are English for now; swap in Arabic later and the layout stays RTL-friendly.
 */
window.PROMO_CONFIG = {
  WHATSAPP_NUMBER: '+961XXXXXXXX',

  announcement:
    '☕ All drinks 300,000 L.L. | 🐾 Free coffee with every grooming!',

  headline: 'Sip While They Shine ☕🐾',
  subheadline: 'Your pet gets a glow-up. You get a free coffee on us.',

  ctaWhatsApp: 'Book Grooming on WhatsApp',
  ctaPrices: 'See Our Prices',
  bookNowLabel: 'Book Now',
  shareLabel: 'Share with a friend',
  genericBookingMessage:
    "Hi Cups & Pups! I'd like to book a grooming appointment.",

  drinksPrice: '300,000 L.L.',
  drinksBannerTitle: 'Every drink: 300,000 L.L.',
  drinksBannerNote: 'Same price on every café drink. Pull up a chair while they shine.',
  drinksCta: 'See the café menu',
  drinksHref: '/menu',

  freeCoffeeBadge: '☕ FREE coffee included',
  freeCoffeeNote: 'Free coffee applies to grooming packages.',

  shareMessage:
    'Sip While They Shine at Cups & Pups — free coffee with every grooming, and every drink is 300,000 L.L.',
  shareUrl: 'https://cupsandpups.store/',

  loyalty: {
    enabled: false,
    text: 'Collect 5 grooming stamps, get the 6th shower free',
  },

  /** ISO date like "2026-12-31T21:00:00+02:00". Empty string turns the countdown off. */
  offerEndsAt: '',

  flyer: {
    enabled: true,
    kicker: 'Today’s flyer',
    title: 'Sip While They Shine',
    intro: 'Two treats. One visit. Your pet glows — you sip.',
    drinksTitle: 'Café drinks',
    drinksText: 'Coffee, iced drinks, the lot — one happy price.',
    groomingTitle: 'Pet grooming',
    groomingText: 'Book a glow-up and your coffee is on us.',
    drinksCta: 'See the menu',
    groomingCta: 'Book grooming',
    closeLabel: 'Maybe later',
  },

  groups: [
    { id: 'cat', label: 'Cats 🐱', species: 'cat' },
    { id: 'dog', label: 'Dogs 🐶 (any size)', species: 'dog' },
  ],

  packages: [
    {
      id: 'cat-groom',
      group: 'cat',
      species: 'cat',
      name: 'Cat Shower + Grooming',
      price: '$15',
      blurb: 'A full glow-up for your cat.',
      includesFreeCoffee: true,
      bestValue: false,
    },
    {
      id: 'cat-shower',
      group: 'cat',
      species: 'cat',
      name: 'Cat Shower only',
      price: '$10',
      blurb: 'A fresh, gentle wash.',
      includesFreeCoffee: false,
      bestValue: false,
    },
    {
      id: 'dog-groom',
      group: 'dog',
      species: 'dog',
      name: 'Dog Shower + Grooming + Haircut',
      price: '$20',
      blurb: 'Any size — our best-value full pamper.',
      includesFreeCoffee: true,
      bestValue: true,
      badge: 'Best Value',
    },
    {
      id: 'dog-shower',
      group: 'dog',
      species: 'dog',
      name: 'Dog Shower only',
      price: '$12',
      blurb: 'Any size. Clean, cozy, and ready for cuddles.',
      includesFreeCoffee: false,
      bestValue: false,
    },
  ],
};
