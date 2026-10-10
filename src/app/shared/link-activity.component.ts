import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from './icon.component';
import { TranslatePipe, I18nService } from './i18n';
import { LinkActivityService, type LinkVisit } from './link-activity.service';
import { VehicleCatalogService } from './vehicle-catalog.service';
import { CompareService } from './compare.service';
import { SettingsService } from './settings.service';
import { formatRM, formatRM2 } from '../data/dashboard-data';
import { modelVariantLabel, vehicleTitle } from '../data/calculator-data';

type Period = 'today' | '7' | '30';
type LinkFilter = 'any' | 'all' | 'brand';

/** One car a visitor looked at in a visit, with the latest quote they built for it. */
type CarLine = {
  id: string;
  name: string;
  quote?: { year?: number; deposit?: number; tenure?: number; monthly?: number; cash?: boolean };
  year?: number;
  actions: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Quote Links → Activity: what visitors did on the advisor's links, grouped into visits — no names,
 * numbers or IC, just which cars and quotes, so the advisor knows who's serious and what to push.
 * Tapping a car opens the Calculator on that exact quote.
 */
@Component({
  selector: 'app-link-activity',
  standalone: true,
  imports: [CommonModule, IconComponent, TranslatePipe],
  template: `
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-col gap-0.5">
          <h3 class="text-base font-semibold">{{ 'Activity' | t }}</h3>
          <p class="text-xs text-muted-foreground">{{ 'What people did on your links — no names or numbers, just the cars and quotes.' | t }}</p>
        </div>
        <button type="button" (click)="reload()" class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <app-icon name="refresh-cw" [size]="13" [class.animate-spin]="activity.loading()" />
          {{ 'Refresh' | t }}
        </button>
      </div>

      <!-- Last 7 days -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        @for (s of stats(); track s.label) {
          <div class="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-card-foreground">
            <span class="text-[11px] font-medium text-muted-foreground">{{ s.label | t }}</span>
            <span class="truncate font-bold tabular-nums" [ngClass]="s.big ? 'text-2xl' : 'text-sm leading-7'">{{ s.value }}</span>
          </div>
        }
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1 rounded-lg bg-muted p-1">
          @for (p of periods; track p.id) {
            <button type="button" (click)="period.set(p.id)" class="rounded-md px-3 py-1 text-xs font-semibold transition-colors" [ngClass]="period() === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
              {{ p.label | t }}
            </button>
          }
        </div>
        <div class="flex gap-1 rounded-lg bg-muted p-1">
          @for (l of linkFilters(); track l.id) {
            <button type="button" (click)="linkFilter.set(l.id)" class="rounded-md px-3 py-1 text-xs font-semibold transition-colors" [ngClass]="linkFilter() === l.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'">
              {{ l.label }}
            </button>
          }
        </div>
      </div>

      <!-- Visits -->
      @if (activity.error()) {
        <p class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{{ "Activity isn't available right now. Try again in a moment." | t }}</p>
      } @else {
        <div class="flex flex-col gap-3">
          @for (v of shownVisits(); track v.key) {
            <article class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                @if (v.returning) {
                  <span class="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">{{ 'Returning visitor' | t }}</span>
                } @else {
                  <span class="rounded-full bg-muted px-2 py-0.5 font-semibold">{{ 'New visitor' | t }}</span>
                }
                <span class="text-muted-foreground">{{ when(v.start) }}</span>
                <span class="text-muted-foreground">· {{ linkName(v.link) }}</span>
              </div>

              @for (c of cars(v); track c.id) {
                <div class="flex flex-col gap-1">
                  <button type="button" (click)="openQuote(c)" class="group flex w-fit items-center gap-1 text-left text-sm font-semibold text-foreground hover:text-primary">
                    {{ c.name }}
                    <app-icon name="arrow-up-right" [size]="13" class="text-muted-foreground group-hover:text-primary" />
                  </button>
                  <span class="text-xs text-muted-foreground">
                    @if (c.quote) {
                      @if (c.quote.cash) {
                        {{ 'Cash' | t }}
                      } @else {
                        {{ money(c.quote.deposit ?? 0) }} {{ 'deposit' | t }} · {{ c.quote.tenure }} {{ 'years' | t }} · <span class="font-semibold text-foreground">{{ money2(c.quote.monthly ?? 0) }}/{{ 'month' | t }}</span>
                      }
                    } @else {
                      {{ 'Looked at' | t }}
                    }
                    @for (a of c.actions; track a) {
                      · {{ a | t }}
                    }
                  </span>
                </div>
              }

              @if (extras(v).length) {
                <ul class="flex flex-col gap-1 text-xs text-muted-foreground">
                  @for (x of extras(v); track x) {
                    <li>{{ x }}</li>
                  }
                </ul>
              }
            </article>
          } @empty {
            <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <app-icon name="share" [size]="20" class="text-muted-foreground" />
              <p class="text-sm font-semibold">{{ (activity.loading() ? 'Loading…' : 'No visits yet') | t }}</p>
              @if (!activity.loading()) {
                <p class="max-w-sm text-xs text-muted-foreground">{{ "Share your link — you'll see which cars people look at and the quotes they build here." | t }}</p>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class LinkActivityComponent implements OnInit {
  activity = inject(LinkActivityService);
  private catalog = inject(VehicleCatalogService);
  private compare = inject(CompareService);
  private router = inject(Router);
  private settings = inject(SettingsService);
  private i18n = inject(I18nService);

  money = formatRM;
  money2 = formatRM2;

  period = signal<Period>('7');
  linkFilter = signal<LinkFilter>('any');
  readonly periods: { id: Period; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '7', label: '7 days' },
    { id: '30', label: '30 days' },
  ];

  linkFilters = computed((): { id: LinkFilter; label: string }[] => [
    { id: 'any', label: this.i18n.t('All links') },
    { id: 'all', label: this.i18n.t('All brands') },
    { id: 'brand', label: this.i18n.t('{brand} only', { brand: this.settings.settings().dashboardTarget.brand }) },
  ]);

  ngOnInit() {
    void this.activity.load(30);
    this.activity.markSeen();
  }

  reload() {
    void this.activity.load(30);
  }

  private since(period: Period): number {
    return period === 'today' ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(period) * DAY_MS;
  }

  private byLink(visits: LinkVisit[]): LinkVisit[] {
    const l = this.linkFilter();
    return l === 'any' ? visits : visits.filter((v) => v.link === l);
  }

  shownVisits = computed(() => {
    const since = this.since(this.period());
    return this.byLink(this.activity.visits()).filter((v) => v.start >= since);
  });

  /** Last 7 days at the top: visits, quotes built, WhatsApp taps and the most-quoted car. */
  stats = computed(() => {
    const since = this.since('7');
    const visits = this.byLink(this.activity.visits()).filter((v) => v.start >= since);
    const events = visits.flatMap((v) => v.events);
    const quoteCounts = new Map<string, number>();
    for (const e of events) if (e.type === 'quote_built' && e.car) quoteCounts.set(e.car, (quoteCounts.get(e.car) ?? 0) + 1);
    const top = [...quoteCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return [
      { label: 'Visits', value: String(visits.length), big: true },
      { label: 'Quotes built', value: String(events.filter((e) => e.type === 'quote_built').length), big: true },
      { label: 'WhatsApp taps', value: String(events.filter((e) => e.type === 'whatsapp_tapped').length), big: true },
      { label: 'Most-quoted car', value: top ? this.carName(top[0]) : '—', big: false },
    ];
  });

  carName(id: string): string {
    const v = this.catalog.vehicles().find((x) => x.id === id);
    return v ? vehicleTitle(v.brand, modelVariantLabel(v.model, v.variant)) : id;
  }

  /** The cars in a visit, each with the last quote built for it and what else they did with it. */
  cars(v: LinkVisit): CarLine[] {
    const lines = new Map<string, CarLine>();
    const line = (id: string) => {
      if (!lines.has(id)) lines.set(id, { id, name: this.carName(id), actions: [] });
      return lines.get(id)!;
    };
    const add = (l: CarLine, a: string) => !l.actions.includes(a) && l.actions.push(a);
    for (const e of v.events) {
      if (!e.car) continue;
      const l = line(e.car);
      const p = e.payload as CarLine['quote'] & { year?: number };
      if (e.type === 'car_viewed') l.year = p.year ?? l.year;
      if (e.type === 'quote_built') l.quote = p;
      if (e.type === 'whatsapp_tapped') {
        if (p.monthly != null) l.quote = p;
        add(l, 'tapped WhatsApp');
      }
      if (e.type === 'brochure_opened') add(l, 'opened brochure');
      if (e.type === 'poster_saved') add(l, 'saved poster');
      if (e.type === 'test_drive_tapped') add(l, 'asked for a test drive');
    }
    return [...lines.values()];
  }

  /** Things in a visit that aren't about one car. */
  extras(v: LinkVisit): string[] {
    const out: string[] = [];
    for (const e of v.events) {
      const p = e.payload as Record<string, unknown>;
      if (e.type === 'budget_used') {
        const cash = p['fullLoan'] ? this.i18n.t('full loan') : typeof p['cash'] === 'number' ? `${this.money(p['cash'] as number)} ${this.i18n.t('cash')}` : '';
        out.push(`${this.i18n.t('Budget')}: ${this.money(Number(p['monthly'] ?? 0))}/${this.i18n.t('month')}${cash ? ' · ' + cash : ''}`);
      }
      if (e.type === 'compare_used' && Array.isArray(p['cars'])) out.push(`${this.i18n.t('Compared')}: ${(p['cars'] as string[]).map((id) => this.carName(id)).join(' vs ')}`);
      if (e.type === 'trade_in' && p['tradeIn'] === true) out.push(this.i18n.t('Has a car to trade in'));
      if (e.type === 'whatsapp_tapped' && !e.car) out.push(this.i18n.t('Tapped WhatsApp'));
    }
    return [...new Set(out)];
  }

  when(at: number): string {
    const d = new Date(at);
    const time = d.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    if (d.toDateString() === new Date().toDateString()) return time;
    if (d.toDateString() === new Date(Date.now() - DAY_MS).toDateString()) return `${this.i18n.t('Yesterday')} ${time}`;
    return `${d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
  }

  linkName(link: 'all' | 'brand'): string {
    return link === 'brand' ? this.i18n.t('{brand} link', { brand: this.settings.settings().dashboardTarget.brand }) : this.i18n.t('All brands link');
  }

  /** Opens the Calculator on that car and the quote the visitor built. */
  openQuote(c: CarLine) {
    const v = this.catalog.vehicles().find((x) => x.id === c.id);
    if (!v) return;
    const newest = Math.max(...v.years.map((y) => y.year));
    const year = c.quote?.year ?? c.year ?? newest;
    const extra = c.quote && !c.quote.cash && c.quote.deposit != null && c.quote.tenure ? { deposit: c.quote.deposit, tenureYears: c.quote.tenure } : undefined;
    this.compare.openInCalculator(v.id, v.years.some((y) => y.year === year) ? year : newest, extra);
    void this.router.navigate(['/calculator']);
  }
}
