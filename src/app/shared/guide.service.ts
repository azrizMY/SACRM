import { Injectable, computed, inject, signal } from '@angular/core';
import { AdvisorService } from './advisor.service';
import { AuthService } from './auth.service';
import { I18nService } from './i18n';
import { SettingsService } from './settings.service';
import { TourService, type TourStep } from './tour.service';
import type { PageId } from './ui-prefs.service';

/** One step of a page's guide: shown as a numbered line in the Help panel, and — when it names a
 *  `target` — pointed at on screen by "Show me on the screen". */
export type GuideStep = { title: string; body: string; target?: string; optional?: boolean };

export type PageGuide = {
  /** One or two plain sentences: what this page is for. */
  about: string;
  steps: GuideStep[];
};

/** Plain-language help for every signed-in page. English is the key for the translation
 *  dictionary (i18n-ms.ts), same as everywhere else in the app. */
export const GUIDES: Record<PageId, PageGuide> = {
  calculator: {
    about: 'Make a quote here. Pick the car, check the monthly instalment, then save or share the poster.',
    steps: [
      { title: 'This is the quote poster', body: 'It is ready to send. Everything on it changes as you change the quote.', target: 'calc-poster' },
      { title: 'Quote and Customize', body: 'Quote shows the poster. Customize is where you change the car, the deposit and the loan.', target: 'calc-tabs', optional: true },
      { title: 'Pick the car', body: 'Choose the brand and the model. The price, rebate and insurance fill in for you.', target: 'calc-car' },
      { title: 'Set the deposit', body: 'Tap 10%, Full Loan or RM 10k, or type your own figure. You can also type the monthly instalment the customer wants.', target: 'calc-loan' },
      { title: 'Save or share', body: 'Save the poster to your phone, or share it straight to WhatsApp.', target: 'calc-share' },
      { title: 'The menu', body: 'Budget, Compare, Quote Links and the rest are here. Tap Help on any page for a short guide like this one.', target: 'nav-menu' },
    ],
  },
  budget: {
    about: 'Start from what the customer can pay each month. Redline lists every car that fits, with the deposit each one needs.',
    steps: [
      { title: 'Type the monthly instalment', body: 'Enter what the customer can pay each month, or tap one of the quick amounts.', target: 'budget-monthly' },
      { title: 'Add the cash they have', body: 'Optional. Leave it empty to see the deposit every car needs, or tap Full loan.', target: 'budget-cash' },
      { title: 'Choose the loan period', body: 'Longer loans mean a lower monthly instalment.', target: 'budget-period' },
      { title: 'Open a car', body: 'Tap a car in the list to turn it into a full quote.' },
    ],
  },
  compare: {
    about: 'Put two or three cars side by side on the same loan, so the customer can see the difference in price and monthly instalment.',
    steps: [
      { title: 'Choose the cars', body: 'Tap Choose a car in each column. You can compare up to 3.', target: 'compare-slots' },
      { title: 'Set one loan for all', body: 'The deposit and loan period you choose apply to every car, so the comparison is fair.' },
      { title: 'Share it', body: 'Save or share the comparison as a picture.' },
    ],
  },
  links: {
    about: 'Your own quote page for customers. They pick a car and work out the numbers themselves, with no app and no login, then send the quote to your WhatsApp.',
    steps: [
      { title: 'Send your link', body: 'Tap Share on WhatsApp, or Copy link and paste it anywhere.', target: 'links-all' },
      { title: 'Or show the QR code', body: 'Customers scan it with their phone camera. Download it to print or post.' },
      { title: 'See what customers looked at', body: 'Activity shows visits and the cars people quoted. It never shows names or phone numbers.', target: 'links-activity' },
    ],
  },
  live: {
    about: 'A big, clear quote for TikTok Live. Viewers see the Live Screen; you change the car and deposit off camera.',
    steps: [
      { title: 'Open the Live Screen', body: 'Open it in its own window and capture only that window in your live stream.', target: 'live-open' },
      { title: 'Change the quote while you talk', body: 'Pick the car and the down payment here. The Live Screen follows straight away.', target: 'live-controls' },
      { title: 'Pin your favourite cars', body: 'Pin the cars you talk about most, then switch between them with one tap.' },
    ],
  },
  cars: {
    about: 'Brochures for every car you sell, ready to open or send on WhatsApp.',
    steps: [
      { title: 'Find the car', body: 'Type a model name in the search box, or scroll the list.', target: 'catalog-search' },
      { title: 'View or share the brochure', body: 'View opens the official brochure. Share sends it on WhatsApp.' },
    ],
  },
  'price-settings': {
    about: 'Your prices and rates. Set them once and every quote, poster and customer link follows them.',
    steps: [
      { title: 'Pick a car', body: 'Choose a car to see and change its price, rebates, interest rate and insurance.' },
      { title: 'Change many cars at once', body: 'Tick several cars to edit them together, or import your price list from a file.' },
      { title: 'Nothing is lost', body: 'Any car you change can be put back to the standard price at any time.' },
      { title: 'Quote defaults', body: 'The deposit, NCD, rate and loan years every new quote starts with are on the Quote defaults tab.' },
    ],
  },
  profile: {
    about: 'Your name, photo, phone number and showroom. These appear on every poster and on your customer quote page.',
    steps: [
      { title: 'Add your photo', body: 'Customers trust a quote more when they can see who sent it.' },
      { title: 'Check your WhatsApp number', body: 'Customers tap it to message you, so make sure it is the number you answer.' },
      { title: 'Your brands', body: 'Choose your main brand and the other brands you sell. Only these show in your lists and on your customer link.' },
    ],
  },
  settings: {
    about: 'How the app and your posters look, your languages and your account.',
    steps: [
      { title: 'Appearance', body: 'Light or dark, and one colour for the app and your posters.' },
      { title: 'Language', body: 'Choose English or Bahasa Melayu for the app, for posters and for WhatsApp messages separately.' },
      { title: 'Account', body: 'Change your password, export your data or delete your account.' },
    ],
  },
};

export type FirstStep = { id: string; label: string; hint: string; link: string; done: boolean };

/**
 * New-user guidance: the first-run welcome, each page's Help panel and on-screen tour, and the
 * "First steps" checklist. The welcome is shown once per account on this device; everything can be
 * opened again from Help.
 */
@Injectable({ providedIn: 'root' })
export class GuideService {
  private tour = inject(TourService);
  private auth = inject(AuthService);
  private settings = inject(SettingsService);
  private advisor = inject(AdvisorService);
  private i18n = inject(I18nService);

  /** The Help panel is open. */
  helpOpen = signal(false);
  /** The first-run welcome is showing. */
  welcomeOpen = signal(false);
  /** A tour step asks the page to bring this target on screen (e.g. switch a phone tab) first. */
  reveal = signal<string | null>(null);

  private scope(): string {
    return this.auth.currentUser()?.id ?? 'device';
  }

  /** Called when the signed-in app opens: greets an account that has never seen the welcome. */
  maybeWelcome() {
    // Someone who has already sent a quote isn't new: no welcome (Help still offers it).
    if (this.settings.settings().onboarding.quoteShared) return;
    if (!this.tour.hasSeen('welcome', this.scope())) this.welcomeOpen.set(true);
  }

  /** Closes the welcome for good on this device. */
  dismissWelcome() {
    this.welcomeOpen.set(false);
    this.tour.markSeenNow('welcome', this.scope());
  }

  /** Points at each part of the page in turn. */
  startTour(page: PageId): Promise<void> {
    this.helpOpen.set(false);
    this.welcomeOpen.set(false);
    this.tour.markSeenNow('welcome', this.scope());
    const guide = GUIDES[page];
    const steps: TourStep[] = guide.steps.map((s) => ({
      target: s.target,
      title: this.i18n.t(s.title),
      body: this.i18n.t(s.body),
      skipIfMissing: s.optional,
      before: s.target
        ? async () => {
            this.reveal.set(s.target!);
            // Let the page react (switch tab, open a section) before the target is measured.
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        : undefined,
    }));
    return this.tour.start(`guide-${page}`, steps, this.scope());
  }

  /** The steps to list in the Help panel: an optional step is left out when the part it explains
   *  isn't on this screen (e.g. the phone-only Quote/Customize tabs on a computer). */
  stepsOnScreen(steps: GuideStep[]): GuideStep[] {
    return steps.filter((s) => {
      if (!s.optional || !s.target) return true;
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
      return !!el && el.getClientRects().length > 0;
    });
  }

  /** Opens Help; the first time also clears the "new" dot on the Help button. */
  openHelp() {
    this.helpOpen.set(true);
    if (!this.helpSeen()) {
      this.tour.markSeenNow('help-opened', this.scope());
      this.helpSeen.set(true);
    }
  }
  private helpSeen = signal(false);
  /** The dot on Help: there are first steps left and Help hasn't been opened yet on this device. */
  helpDot = computed(() => this.firstStepsVisible() && !this.helpSeen() && !this.tour.hasSeen('help-opened', this.scope()));

  /** Whether "Show me on the screen" has anything to point at on this page. */
  hasTour(page: PageId): boolean {
    return GUIDES[page].steps.some((s) => !!s.target);
  }

  /** The things a new account should do once, each ticked from real data. */
  firstSteps = computed<FirstStep[]>(() => {
    const s = this.settings.settings();
    return [
      { id: 'brands', label: 'Choose the brands you sell', hint: 'Only these brands show in your lists.', link: '/profile', done: !this.settings.brandsISellUnset() },
      { id: 'photo', label: 'Add your photo', hint: 'It appears on every poster and on your quote page.', link: '/profile', done: !!this.advisor.profile().photoUrl },
      { id: 'prices', label: 'Check your prices and rates', hint: 'Every quote follows what you set here.', link: '/price-settings', done: !!s.onboarding.pricesReviewed },
      { id: 'quote', label: 'Share your first quote', hint: 'Make a quote and send the poster to someone.', link: '/calculator', done: !!s.onboarding.quoteShared },
      { id: 'links', label: 'Send your Quote Link to a customer', hint: 'Ticks when a customer opens it.', link: '/links', done: !!s.onboarding.linkOpened },
    ];
  });
  firstStepsDone = computed(() => this.firstSteps().filter((s) => s.done).length);
  firstStepsLeft = computed(() => this.firstSteps().length - this.firstStepsDone());
  /** The first step still to do — highlighted with a Go button. */
  nextStep = computed(() => this.firstSteps().find((s) => !s.done) ?? null);
  /** Show the checklist (and the dot on Help) until everything is done or it has been put away. */
  firstStepsVisible = computed(() => this.firstStepsLeft() > 0 && !this.settings.settings().onboarding.hidden);

  hideFirstSteps() {
    this.settings.updateOnboarding({ hidden: true });
  }
}
