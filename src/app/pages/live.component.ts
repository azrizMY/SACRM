import { Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { TranslatePipe } from '../shared/i18n';
import { QuoteEngine } from '../shared/quote-engine';
import { QuoteControlsComponent } from '../shared/quote-controls.component';
import { LiveScreenComponent, stripContact, type LiveScreenData } from '../shared/live-screen.component';
import { SettingsService } from '../shared/settings.service';
import { AdvisorService } from '../shared/advisor.service';
import { ToastService } from '../shared/toast.service';
import { VEHICLES, formatRM, modelVariantLabel, type Vehicle } from '../data/calculator-data';
import { brandLogo, formatMalaysianPhone } from '../data/dashboard-data';
import { LIVE_SCREEN_SIZES, type LiveQuoteMemory, type LiveScreenSize, type LiveSettings } from '../data/settings-data';
import { posterAccent } from '../shared/poster-theme';

/** The pop-out Live Screen window listens on this channel; this page answers with the current screen. */
export const LIVE_CHANNEL = 'redline-live';
/** hello/alive/bye come from the pop-out (alive every couple of seconds while it's open); screen/close go to it. */
export type LiveChannelMessage = { type: 'hello' } | { type: 'alive' } | { type: 'bye' } | { type: 'close' } | { type: 'screen'; data: LiveScreenData };

/** How often the pop-out says it's still open, and how long without hearing from it counts as closed. */
export const LIVE_ALIVE_MS = 2000;
const LIVE_GONE_MS = 5000;


type Toggle = { key: keyof Pick<LiveSettings, 'showAdvisor' | 'showBrandLogo' | 'showEstimateNote' | 'showShowroom' | 'showPhone' | 'showWhatsApp'>; label: string; hint: string };

const TOGGLES: Toggle[] = [
  { key: 'showAdvisor', label: 'Your name and photo', hint: 'Shows who is presenting.' },
  { key: 'showBrandLogo', label: 'Brand logo', hint: 'Next to the car name.' },
  { key: 'showEstimateNote', label: '"Estimate only" note', hint: 'Recommended whenever you show loan figures.' },
  { key: 'showShowroom', label: 'Showroom name', hint: 'Your showroom from Profile — never the address.' },
  { key: 'showPhone', label: 'Phone number', hint: 'TikTok restricts sharing contact details on LIVE.' },
  { key: 'showWhatsApp', label: 'WhatsApp icon', hint: 'Only with the phone number on.' },
];

/** Down-payment quick buttons, in RM (0 = the car's minimum / full loan). */
const DP_CHIPS = [0, 5000, 10000, 15000, 20000];

/**
 * Live Mode: a loan calculator for TikTok Live. The SA works the controls (the Calculator's own,
 * shared via QuoteControlsComponent and QuoteEngine) while the Live Screen — the only thing
 * captured on stream — shows a clean, big-number quote with nothing TikTok would treat as taking
 * viewers off the platform. Tablet and PC only; phones get a short note instead.
 */
@Component({
  selector: 'app-live',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, IconComponent, TranslatePipe, QuoteControlsComponent, LiveScreenComponent],
  // Tablet and PC: exactly the height of the main area, so the page itself never scrolls — only the
  // settings panels do.
  host: { class: 'block md:h-full' },
  template: `
    <!-- Phones -->
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center md:hidden">
      <span class="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><app-icon name="live" [size]="28" /></span>
      <h2 class="text-lg font-bold">{{ "Live Mode needs a bigger screen." | t }}</h2>
      <p class="max-w-xs text-sm text-muted-foreground">{{ "Open it on a tablet or computer to go live." | t }}</p>
    </div>

    <!-- Tablet and PC. Full screen lifts this whole workspace over the app's menu and top bar. -->
    <div
      class="hidden flex-col gap-3 md:flex xl:gap-4"
      [ngClass]="fullscreen() ? 'fixed inset-0 z-[100] bg-background p-3 xl:p-4' : 'mx-auto h-full max-w-[1600px]'"
    >
      @if (!fullscreen()) {
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <h2 class="text-xl font-bold tracking-tight">{{ "Live Mode" | t }}</h2>
            <p class="hidden text-sm text-muted-foreground xl:block">{{ "A loan calculator for TikTok Live — capture only the Live Screen, keep the controls to yourself." | t }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <ng-container *ngTemplateOutlet="resetBtn" />
            <button type="button" (click)="enterFullscreen()" class="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent">
              <app-icon name="maximize" [size]="13" />
              {{ "Full screen" | t }}
            </button>
            <button type="button" (click)="openPopout()" class="hidden items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground lg:flex">
              <app-icon name="arrow-up-right" [size]="13" />
              {{ "Open Live Screen window" | t }}
            </button>
          </div>
        </div>
      }

      <!--
        PC: Display settings | Live Screen | quick picks + Quote.
        Landscape tablet: Live Screen | quick picks + Quote / Display tabs.
        Portrait tablet: Live Screen on top, the same panel below.
      -->
      <div
        class="grid min-h-0 flex-1 gap-3
          grid-cols-[minmax(0,1fr)_380px] grid-rows-[minmax(0,1fr)]
          max-xl:portrait:grid-cols-1 max-xl:portrait:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)]
          xl:grid-cols-[250px_minmax(0,1fr)_400px] xl:gap-4"
      >
        <!-- PC only: display settings on the left -->
        <aside class="hidden min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1 xl:col-start-1 xl:row-start-1 xl:flex">
          <ng-container *ngTemplateOutlet="displaySettings" />
        </aside>

        <!-- The Live Screen, as big as the space allows — steps aside while the pop-out window shows it -->
        <section class="col-start-1 row-start-1 min-h-0 min-w-0 border border-border bg-muted/40 xl:col-start-2">
          @if (popoutOpen()) {
            <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span class="flex size-12 items-center justify-center bg-primary/10 text-primary"><app-icon name="arrow-up-right" [size]="22" /></span>
              <span class="text-sm font-semibold">{{ "Showing in the Live Screen window" | t }}</span>
              <span class="max-w-sm text-xs text-muted-foreground">{{ "Everything you change here appears there straight away. The preview comes back when you close the window." | t }}</span>
              <button type="button" (click)="closePopout()" class="mt-1 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-accent">
                {{ "Close the window" | t }}
              </button>
            </div>
          } @else {
            <app-live-screen [data]="screenData()" />
          }
        </section>

        <!-- Right on PC and landscape tablets, below on portrait tablets: quick picks, then the settings -->
        <div
          class="col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col gap-3
            max-xl:portrait:col-start-1 max-xl:portrait:row-start-2
            xl:col-start-3"
        >
          @if (fullscreen()) {
            <div class="flex shrink-0 items-center justify-end gap-2">
              <ng-container *ngTemplateOutlet="resetBtn" />
              <button type="button" (click)="exitFullscreen()" class="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent">
                <app-icon name="x" [size]="13" />
                {{ "Exit full screen" | t }}
              </button>
            </div>
          }

          <!-- Quick picks: one tap while live -->
          <div class="flex shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Favourites" | t }}</span>
              <button
                type="button"
                (click)="toggleFavourite()"
                class="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
                [ngClass]="isFavourite() ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'"
              >
                <app-icon name="star" [size]="12" />
                {{ (isFavourite() ? 'Pinned' : 'Pin this car') | t }}
              </button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (v of favourites(); track v.id; let i = $index) {
                <button
                  type="button"
                  (click)="pickFavourite(v)"
                  class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  [ngClass]="v.id === q.selectedVehicle().id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'"
                >
                  <span class="rounded bg-black/15 px-1 font-mono text-[10px]">{{ i + 1 }}</span>
                  {{ carLabel(v) }}
                </button>
              } @empty {
                <span class="text-xs text-muted-foreground">{{ "Pin the cars you talk about most — then switch with one tap or keys 1–9." | t }}</span>
              }
            </div>
            <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Down payment" | t }}</span>
            <div class="flex flex-wrap gap-1.5">
              @for (amount of dpChips; track amount) {
                <button
                  type="button"
                  (click)="setDownpayment(amount)"
                  [disabled]="q.cashbackOn()"
                  class="rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors disabled:opacity-40"
                  [ngClass]="isDownpayment(amount) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'"
                >
                  {{ amount === 0 ? ((q.minDownpayment() > 0 ? 'Minimum' : 'Full Loan') | t) : fmtK(amount) }}
                </button>
              }
            </div>
            <span class="hidden text-[11px] text-muted-foreground xl:block">{{ "Keys: 1–9 favourites · ↑ ↓ down payment ±RM 1,000" | t }}</span>
          </div>

          <!-- Tablets: the quote and the display settings share this space, one tab at a time -->
          <div class="flex shrink-0 gap-1 rounded-xl border border-border bg-card p-1 xl:hidden">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                (click)="panel.set(tab.id)"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors"
                [ngClass]="panel() === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
              >
                <app-icon [name]="tab.icon" [size]="14" />
                {{ tab.label | t }}
              </button>
            }
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div class="flex-col gap-4 xl:flex" [ngClass]="panel() === 'quote' ? 'flex' : 'hidden'">
              <app-quote-controls [q]="q" />
            </div>
            <div class="flex-col gap-4 xl:hidden" [ngClass]="panel() === 'display' ? 'flex' : 'hidden'">
              <ng-container *ngTemplateOutlet="displaySettings" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #resetBtn>
      <button type="button" (click)="q.reset()" class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
        <app-icon name="refresh-cw" [size]="13" />
        {{ "Reset quote" | t }}
      </button>
    </ng-template>

    <!-- How the Live Screen looks: the left column on PC, the Display tab on tablets -->
    <ng-template #displaySettings>
      <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div class="flex flex-col gap-0.5">
          <span class="flex items-center gap-2 text-sm font-semibold"><app-icon name="settings" [size]="14" class="text-muted-foreground" />{{ "Advanced settings" | t }}</span>
          <span class="text-[11px] text-muted-foreground">{{ "How the Live Screen looks — saved for next time" | t }}</span>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted-foreground">{{ "Screen size" | t }}</span>
          @for (s of sizes; track s.id) {
            <button
              type="button"
              (click)="update({ size: s.id })"
              class="flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors"
              [ngClass]="live().size === s.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center">
                <span class="block border-2" [ngClass]="live().size === s.id ? 'border-primary' : 'border-muted-foreground/50'" [style.width.px]="s.width / 45" [style.height.px]="s.height / 45"></span>
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="text-[13px] font-semibold">{{ s.label | t }}</span>
                <span class="text-[11px] leading-snug text-muted-foreground">{{ s.hint | t }}</span>
              </span>
            </button>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted-foreground">{{ "Live Screen language" | t }}</span>
          <div class="flex w-fit gap-1 rounded-lg bg-muted p-1">
            @for (l of langs; track l.id) {
              <button
                type="button"
                (click)="update({ lang: l.id })"
                class="rounded-md px-4 py-1.5 text-xs font-semibold transition-colors"
                [ngClass]="live().lang === l.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              >
                {{ l.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex flex-col">
          <span class="mb-1 text-xs font-semibold text-muted-foreground">{{ "Show on the Live Screen" | t }}</span>
          @for (tg of toggles; track tg.key) {
            <label class="-mx-1 flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-accent/50" [class.opacity-50]="tg.key === 'showWhatsApp' && !live().showPhone">
              <input
                type="checkbox"
                [checked]="live()[tg.key]"
                [disabled]="tg.key === 'showWhatsApp' && !live().showPhone"
                (change)="flip(tg.key)"
                class="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span class="flex flex-col">
                <span class="text-[13px] font-medium">{{ tg.label | t }}</span>
                <span class="text-[11px] leading-snug text-muted-foreground">{{ tg.hint | t }}</span>
              </span>
            </label>
          }
        </div>

        <p class="rounded-lg bg-[var(--warning)]/10 px-3 py-2 text-[11px] text-foreground">
          {{ "Phone and WhatsApp start off — TikTok can restrict LIVEs that share contact details or send viewers elsewhere. Anything that looks like a phone number or link is also filtered out of your name and showroom." | t }}
        </p>
      </div>
    </ng-template>
  `,
})
export class LiveComponent implements OnDestroy {
  private settings = inject(SettingsService);
  private advisor = inject(AdvisorService);
  private toast = inject(ToastService);

  /** This page's own quote — settings and prices still come from Settings and Price Settings. */
  readonly q = new QuoteEngine();

  live = computed(() => this.settings.settings().live);
  dims = computed(() => LIVE_SCREEN_SIZES[this.live().size]);

  sizes = (Object.keys(LIVE_SCREEN_SIZES) as LiveScreenSize[]).map((id) => ({ id, ...LIVE_SCREEN_SIZES[id] }));
  langs: { id: LiveSettings['lang']; label: string }[] = [
    { id: 'ms', label: 'BM' },
    { id: 'en', label: 'EN' },
  ];
  toggles = TOGGLES;
  /** Tablets show the quote and the display settings in one panel, one tab at a time. */
  panel = signal<'quote' | 'display'>('quote');
  tabs = [
    { id: 'quote' as const, label: 'Quote', icon: 'calculator' as const },
    { id: 'display' as const, label: 'Display', icon: 'settings' as const },
  ];
  dpChips = DP_CHIPS;

  favourites = computed(() =>
    this.live()
      .favourites.map((id) => VEHICLES.find((v) => v.id === id))
      .filter((v): v is Vehicle => !!v),
  );
  isFavourite = computed(() => this.live().favourites.includes(this.q.selectedVehicle().id));

  /** When the pop-out last said it was open — the preview steps aside while it is. */
  private popoutSeenAt = signal(0);
  private now = signal(Date.now());
  popoutOpen = computed(() => this.now() - this.popoutSeenAt() < LIVE_GONE_MS);
  private clock = setInterval(() => this.now.set(Date.now()), 1000);

  /** What the Live Screen (here and in the pop-out) shows — contact details only when switched on. */
  screenData = computed<LiveScreenData>(() => {
    const q = this.q;
    const live = this.live();
    const v = q.selectedVehicle();
    const profile = this.advisor.profile();
    const dp = q.downpaymentCash();
    return {
      size: live.size,
      lang: live.lang,
      brand: v.brand,
      logoUrl: live.showBrandLogo ? brandLogo(v.brand) : null,
      title: modelVariantLabel(v.model, v.variant),
      year: q.modelYear(),
      imageUrl: v.photoUrl ?? null,
      cash: q.isCashPurchase(),
      sellingPrice: q.allInPrice(),
      carPrice: q.basePrice(),
      insurance: q.insurance(),
      rebate: q.effectiveRebate() - q.totals().cashback,
      // Rounding the loan up can leave a negative down payment — that's cash back too.
      downpayment: Math.max(0, dp),
      loanAmount: q.loanAmount(),
      cashback: q.totals().cashback + (dp < 0 ? -dp : 0),
      rateLabel: `${q.interestRate()}% ${q.rateType() === 'flat' ? (live.lang === 'ms' ? 'rata' : 'flat') : 'EIR'}`,
      rateMissing: q.rateMissing(),
      tenures: q.repaymentRows().map((r) => ({ years: r.months / 12, months: r.months, monthly: r.monthly })),
      advisor: live.showAdvisor ? { name: stripContact(profile.name), role: stripContact(profile.role ?? ''), photoUrl: profile.photoUrl ?? null, initials: this.advisor.initials() } : null,
      showroom: live.showShowroom && profile.showroom?.name ? stripContact(profile.showroom.name) || null : null,
      phone: live.showPhone && profile.phoneDisplay ? formatMalaysianPhone(profile.phoneDisplay) : null,
      whatsapp: live.showPhone && live.showWhatsApp,
      estimateNote: live.showEstimateNote,
      accent: posterAccent(this.settings.settings().salesDefaults.posterAccent).acc,
    };
  });

  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LIVE_CHANNEL) : null;

  constructor() {
    this.restoreLastQuote();

    // Keep the pop-out window in step, and answer it when it opens.
    effect(() => this.post(this.screenData()));
    if (this.channel) {
      this.channel.onmessage = (e: MessageEvent<LiveChannelMessage>) => {
        const type = e.data?.type;
        if (type === 'hello' || type === 'alive') {
          this.popoutSeenAt.set(Date.now());
          this.now.set(Date.now());
        }
        if (type === 'hello') this.post(this.screenData());
        if (type === 'bye') this.popoutSeenAt.set(0);
      };
    }

    // Remember the quote so reopening Live Mode carries on where you stopped (saved a moment after changes settle).
    effect((onCleanup) => {
      const memory: LiveQuoteMemory = {
        vehicleId: this.q.selectedVehicle().id,
        year: this.q.modelYear(),
        downpaymentType: this.q.downpaymentType(),
        downpaymentValue: this.q.downpaymentValue(),
        tenureYears: this.q.posterTenureYears(),
        highlightedTenure: this.q.highlightedTenure(),
      };
      const timer = setTimeout(() => {
        if (JSON.stringify(memory) !== JSON.stringify(this.settings.settings().live.lastQuote)) this.settings.updateLive({ lastQuote: memory });
      }, 1500);
      onCleanup(() => clearTimeout(timer));
    });
  }

  ngOnDestroy() {
    clearInterval(this.clock);
    if (this.fullscreen()) this.exitFullscreen();
    this.channel?.close();
  }

  private post(data: LiveScreenData) {
    this.channel?.postMessage({ type: 'screen', data } satisfies LiveChannelMessage);
  }

  private restoreLastQuote() {
    const last = this.settings.settings().live.lastQuote;
    const v = last && VEHICLES.find((x) => x.id === last.vehicleId);
    if (!last || !v) return;
    this.q.selectCar(v.brand, v.model, v.variant, last.year);
    this.q.downpaymentType.set(last.downpaymentType);
    this.q.downpaymentValue.set(last.downpaymentValue);
    if (last.tenureYears?.length) this.q.posterTenureYears.set(last.tenureYears);
    if (last.highlightedTenure) this.q.highlightedTenure.set(last.highlightedTenure);
  }

  update(patch: Partial<LiveSettings>) {
    this.settings.updateLive(patch);
  }

  flip(key: Toggle['key']) {
    this.update({ [key]: !this.live()[key] });
  }

  // ---------- Favourites ----------

  carLabel(v: Vehicle): string {
    return modelVariantLabel(v.model, v.variant);
  }

  pickFavourite(v: Vehicle) {
    this.q.selectCar(v.brand, v.model, v.variant);
  }

  toggleFavourite() {
    const id = this.q.selectedVehicle().id;
    const list = this.live().favourites;
    if (list.includes(id)) {
      this.update({ favourites: list.filter((x) => x !== id) });
    } else if (list.length >= 9) {
      this.toast.show('You can pin up to 9 cars — unpin one first');
    } else {
      this.update({ favourites: [...list, id] });
    }
  }

  // ---------- Down payment ----------

  fmtK(amount: number): string {
    return amount >= 1000 ? `RM ${amount / 1000}k` : formatRM(amount);
  }

  setDownpayment(amount: number) {
    if (amount === 0) {
      this.q.applyDownpaymentPreset('fullLoan');
      return;
    }
    this.q.downpaymentType.set('amount');
    this.q.downpaymentValue.set(amount);
  }

  isDownpayment(amount: number): boolean {
    if (amount === 0) return this.q.isDownpaymentPreset('fullLoan');
    return this.q.downpaymentType() === 'amount' && this.q.downpaymentValue() === amount;
  }

  // ---------- Keyboard (PC): 1–9 favourites, ↑/↓ down payment ----------

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (e.key === 'Escape' && this.fullscreen()) {
      this.exitFullscreen();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) || target?.isContentEditable) return;
    if (/^[1-9]$/.test(e.key)) {
      const v = this.favourites()[Number(e.key) - 1];
      if (v) {
        e.preventDefault();
        this.pickFavourite(v);
      }
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !this.q.cashbackOn()) {
      e.preventDefault();
      const current = Math.max(0, this.q.downpaymentCash());
      const next = Math.max(0, Math.round(current / 1000) * 1000 + (e.key === 'ArrowUp' ? 1000 : -1000));
      this.q.downpaymentType.set('amount');
      this.q.downpaymentValue.set(next);
    }
  }

  // ---------- Full screen: the Live workspace over the whole display, no app menu or top bar ----------

  fullscreen = signal(false);

  enterFullscreen() {
    this.fullscreen.set(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  exitFullscreen() {
    this.fullscreen.set(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  /** Leaving the browser's full screen (Esc, or the system gesture) leaves ours too. */
  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    if (!document.fullscreenElement && this.fullscreen()) this.exitFullscreen();
  }

  // ---------- Pop-out Live Screen (PC) ----------

  openPopout() {
    const { width, height } = this.dims();
    const w = window.open('/live-screen', 'redline-live-screen', `popup=yes,width=${Math.round(width / 2)},height=${Math.round(height / 2)}`);
    if (!w) this.toast.show('Your browser blocked the window — allow pop-ups for this site and try again');
  }

  closePopout() {
    this.channel?.postMessage({ type: 'close' } satisfies LiveChannelMessage);
    this.popoutSeenAt.set(0);
  }
}
