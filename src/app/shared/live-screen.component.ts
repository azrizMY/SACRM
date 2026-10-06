import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LIVE_SCREEN_SIZES, type LiveScreenSize } from '../data/settings-data';
import { POSTER_COLORS, POSTER_FONTS, posterFontsReady } from './poster-theme';
import { CarShadowPipe } from './car-shadow';

/** Everything the Live Screen shows — a plain snapshot, so the pop-out window can be sent the
 *  same object over a BroadcastChannel. Built by the Live page from its quote and Live settings. */
export type LiveScreenData = {
  size: LiveScreenSize;
  lang: 'ms' | 'en';
  brand: string;
  logoUrl: string | null;
  title: string;
  year: number;
  imageUrl: string | null;
  cash: boolean;
  /** What the customer pays, rebate already off. */
  sellingPrice: number;
  /** The car's own price (OTR), before insurance and rebate — the breakdown table adds them up. */
  carPrice: number;
  insurance: number;
  /** The part of the rebate taken off the price (any cash back is paid out instead, not deducted). */
  rebate: number;
  downpayment: number;
  loanAmount: number;
  cashback: number;
  rateLabel: string;
  rateMissing: boolean;
  /** Longest first, as on the poster. */
  tenures: { years: number; months: number; monthly: number }[];
  advisor: { name: string; role: string; photoUrl: string | null; initials: string } | null;
  showroom: string | null;
  phone: string | null;
  whatsapp: boolean;
  estimateNote: boolean;
  /** The advisor's poster colour as a hex — sent along so the pop-out window matches too. */
  accent?: string;
};

const TEXT = {
  en: {
    eyebrow: 'Car loan estimate',
    lowest: 'Lowest monthly',
    cashPrice: 'Cash price',
    perMonth: '/month',
    years: (n: number) => `${n} years`,
    over: (tenure: string) => `over ${tenure}`,
    carPrice: 'Car price',
    insurance: 'Insurance',
    rebate: 'Rebate',
    total: 'Total price',
    downpayment: 'Down payment',
    cashBack: 'Cash back to you',
    loan: 'Loan amount',
    rateNeeded: 'To be confirmed',
    estimate: 'Estimate only — subject to bank approval.',
  },
  ms: {
    eyebrow: 'Kiraan pinjaman kereta',
    lowest: 'Bulanan serendah',
    cashPrice: 'Harga tunai',
    perMonth: '/bulan',
    years: (n: number) => `${n} tahun`,
    over: (tenure: string) => `untuk ${tenure}`,
    carPrice: 'Harga kereta',
    insurance: 'Insurans',
    rebate: 'Rebat',
    total: 'Jumlah harga',
    downpayment: 'Deposit',
    cashBack: 'Pulangan tunai',
    loan: 'Jumlah pinjaman',
    rateNeeded: 'Belum disahkan',
    estimate: 'Anggaran sahaja — tertakluk kepada kelulusan bank.',
  },
};

/** Phone numbers, links and @handles — never shown on stream unless the SA turned the phone on
 *  (and then only in its own line). Catches contact details hidden inside a name or showroom. */
export function stripContact(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+|wa\.me\S*|\b\S+\.(?:com|my|net|org|link|me|co)\b\S*/gi, '')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '')
    .replace(/@[\w.]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * What viewers see on TikTok Live. Drawn at a fixed size (see LIVE_SCREEN_SIZES) and scaled to
 * fit whatever space it's given, so the layout never shifts mid-stream and the crop in LIVE
 * Studio / OBS only has to be set once.
 *
 * Read in one order, top to bottom, at every size: the car → the one monthly figure that answers
 * "how much?" → the other tenures → a labelled breakdown of where that figure comes from. The car
 * takes whatever height the numbers leave, so the screen is always filled edge to edge.
 */
@Component({
  selector: 'app-live-screen',
  standalone: true,
  imports: [CommonModule, CarShadowPipe],
  host: { class: 'block h-full w-full' },
  template: `
    <div #frame class="relative h-full w-full overflow-hidden">
      @if (data; as d) {
        <div
          class="ls"
          [ngClass]="'size-' + d.size"
          [style.width.px]="dims().width"
          [style.height.px]="dims().height"
          [style.transform]="'translate(-50%, -50%) scale(' + scale() + ')'"
          [style.--acc]="d.accent || colors.acc"
          [style.--ink]="colors.ink"
          [style.--display]="fonts.display"
          [style.--label]="fonts.label"
        >
          <!-- Top: name and logo on the left, the car on the right taking the full height the numbers leave -->
          <div class="top">
            <div class="head">
              <div class="head-text">
                <div class="eyebrow">{{ t().eyebrow }}</div>
                <div class="title">{{ d.title }}</div>
              </div>
              @if (d.logoUrl) {
                <img [src]="d.logoUrl" alt="" class="logo" />
              }
            </div>
            <div class="car">
              @if (d.imageUrl) {
                <!-- The same ground shadow as the posters -->
                <img [src]="d.imageUrl | carShadow" alt="" />
              }
            </div>
          </div>

          <!-- Bottom: the answer, the other tenures, then where it comes from -->
          <div class="bottom">
            <div class="hero">
              <div class="hero-main">
                <div class="hero-label">{{ d.cash ? t().cashPrice : t().lowest }}</div>
                <div class="hero-fig">
                  <span class="cur">RM</span>
                  <span class="big" [style.font-size]="'calc(var(--hero) * ' + heroShrink(d) + ')'">{{ d.cash ? n(d.sellingPrice) : d.rateMissing ? '—' : n(lowest(d)?.monthly ?? 0) }}</span>
                  @if (!d.cash) {
                    <span class="per">{{ t().perMonth }}</span>
                  }
                </div>
                @if (!d.cash && lowest(d); as row) {
                  <div class="hero-sub">{{ t().over(yearsLabel(row)) }} · {{ d.rateMissing ? t().rateNeeded : d.rateLabel }}</div>
                }
              </div>
              @if (d.advisor; as a) {
                <div class="advisor">
                  @if (a.photoUrl) {
                    <img [src]="a.photoUrl" alt="" />
                  } @else {
                    <span class="initials">{{ a.initials }}</span>
                  }
                  <div class="advisor-text">
                    <div class="advisor-name">{{ a.name }}</div>
                    @if (a.role) {
                      <div class="advisor-role">{{ a.role }}</div>
                    }
                  </div>
                </div>
              }
            </div>

            @if (!d.cash && others(d).length) {
              <div class="others" [style.grid-template-columns]="'repeat(' + others(d).length + ', minmax(0, 1fr))'">
                @for (row of others(d); track row.months) {
                  <div class="other">
                    <span class="chip">{{ yearsLabel(row) }}</span>
                    <span class="other-fig"><span class="cur">RM</span>{{ d.rateMissing ? '—' : n(row.monthly) }}<span class="per">{{ t().perMonth }}</span></span>
                  </div>
                }
              </div>
            }

            @if (!d.cash) {
              <!-- How the price adds up… -->
              <div class="table">
                <div class="tr"><span>{{ t().carPrice }}</span><b>RM {{ n(d.carPrice) }}</b></div>
                <div class="tr"><span>{{ t().insurance }}</span><b>+ RM {{ n(d.insurance) }}</b></div>
                <div class="tr"><span>{{ t().rebate }}</span><b [class.good]="d.rebate > 0">{{ d.rebate > 0 ? '− ' : '' }}RM {{ n(d.rebate) }}</b></div>
                <div class="tr total"><span>{{ t().total }}</span><b>RM {{ n(d.sellingPrice) }}</b></div>
              </div>
              <!-- …and how that total is paid -->
              <div class="split">
                @if (d.cashback > 0) {
                  <div class="cell"><span>{{ t().cashBack }}</span><b class="good">RM {{ n(d.cashback) }}</b></div>
                } @else {
                  <div class="cell"><span>{{ t().downpayment }}</span><b>RM {{ n(d.downpayment) }}</b></div>
                }
                <div class="cell"><span>{{ t().loan }}</span><b>RM {{ n(d.loanAmount) }}</b></div>
              </div>
            }

            @if (d.phone) {
              <div class="phone" [class.wa]="d.whatsapp">
                @if (d.whatsapp) {
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.2-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>
                }
                <span>{{ d.phone }}</span>
              </div>
            }
            @if (d.estimateNote || d.showroom) {
              <div class="foot">
                <span>{{ d.estimateNote ? t().estimate : '' }}</span>
                @if (d.showroom) {
                  <span class="showroom">{{ d.showroom }}</span>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* Fixed design pixels, scaled as a whole; one top-to-bottom design for every size, the
         sizes only change the measurements below. Sharp corners throughout. */
      .ls {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-origin: center center;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #fff;
        color: var(--ink);
        font-family: var(--label);
      }
      .ls * { box-sizing: border-box; }
      .ls img { display: block; }

      /* ---- top: the car ---- */
      .top {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 0.42fr) minmax(0, 0.58fr);
        gap: var(--gap);
        padding: var(--pad) calc(var(--pad) * 0.6) 0 var(--pad);
        background: radial-gradient(80% 70% at 50% 75%, #ffffff 0%, #eceef1 70%, #e3e5e9 100%);
      }
      .head { display: flex; flex-direction: column; min-width: 0; padding-bottom: calc(var(--gap) * 1.4); }
      .head-text { min-width: 0; }
      .eyebrow {
        display: flex; align-items: center; gap: 0.6em;
        font-size: var(--eyebrow); font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; color: #55555c; white-space: nowrap;
      }
      .eyebrow::before { content: ''; width: 1.6em; height: 0.24em; background: var(--acc); flex-shrink: 0; }
      .title {
        margin-top: 0.12em;
        padding-bottom: 0.08em;
        font-family: var(--display); font-size: var(--title); font-weight: 700; line-height: 1.12; letter-spacing: -0.01em;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      /* Fits a box rather than one fixed height: wide wordmarks are held by the width, round badges get more height. */
      .logo { margin-top: auto; align-self: flex-start; width: auto; height: auto; max-width: 100%; max-height: calc(var(--logo) * 1.5); object-fit: contain; object-position: left bottom; }
      .car { min-height: 0; min-width: 0; display: flex; align-items: flex-end; justify-content: center; }
      .car img { max-width: 100%; max-height: 100%; object-fit: contain; }

      /* ---- bottom: the numbers ---- */
      .bottom { display: flex; flex-direction: column; gap: var(--gap); padding: var(--gap) var(--pad) var(--pad); border-top: calc(var(--gap) * 0.5) solid var(--acc); }

      .hero { display: flex; align-items: center; gap: calc(var(--gap) * 2); }
      .hero-main { flex: 1; min-width: 0; }
      .hero-label { font-size: var(--hero-label); font-weight: 700; color: #3b3b42; }
      .hero-fig { display: flex; align-items: baseline; color: var(--acc); font-family: var(--display); font-weight: 700; line-height: 0.95; white-space: nowrap; }
      .hero-fig .cur { font-size: calc(var(--hero) * 0.4); margin-right: 0.12em; }
      .hero-fig .big { font-size: var(--hero); }
      .hero-fig .per { font-size: calc(var(--hero) * 0.26); color: #6b6b73; margin-left: 0.3em; }
      .hero-sub { font-size: var(--hero-sub); font-weight: 600; color: #55555c; margin-top: 0.2em; }

      .advisor { display: flex; align-items: center; gap: calc(var(--gap) * 1.2); min-width: 0; max-width: 40%; padding-left: calc(var(--gap) * 2); border-left: 2px solid #e6e6ea; }
      .advisor img, .advisor .initials { width: var(--avatar); height: var(--avatar); object-fit: cover; flex-shrink: 0; border-radius: 9999px; }
      .advisor .initials { display: flex; align-items: center; justify-content: center; background: var(--ink); color: #fff; font-family: var(--display); font-weight: 700; font-size: calc(var(--avatar) * 0.38); }
      .advisor-text { min-width: 0; }
      .advisor-name { font-family: var(--display); font-size: var(--adv-name); font-weight: 700; line-height: 1.2; padding-bottom: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .advisor-role { font-size: var(--adv-role); line-height: 1.35; color: #6b6b73; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .others { display: grid; gap: calc(var(--gap) * 0.7); }
      .other { display: flex; align-items: stretch; height: var(--ten-h); border: 2px solid #e6e6ea; min-width: 0; }
      .chip { display: flex; align-items: center; padding: 0 0.6em; background: var(--ink); color: #fff; font-family: var(--display); font-size: var(--ten-chip); font-weight: 700; white-space: nowrap; }
      .other-fig { flex: 1; display: flex; align-items: baseline; justify-content: flex-end; align-self: center; padding: 0 0.4em; font-family: var(--display); font-size: var(--ten-fig); font-weight: 700; color: var(--acc); white-space: nowrap; }
      .other-fig .cur { font-size: 0.55em; color: #6b6b73; margin-right: 0.15em; }
      .other-fig .per { font-size: 0.5em; color: #6b6b73; margin-left: 0.2em; }

      .table { display: flex; flex-direction: column; border-top: 2px solid var(--ink); }
      .tr { display: flex; align-items: center; justify-content: space-between; gap: 20px; height: var(--row); border-bottom: 2px solid #ececf0; }
      .tr span { font-size: var(--row-label); color: #3b3b42; font-weight: 500; }
      .tr b { font-family: var(--display); font-size: var(--row-val); font-weight: 700; white-space: nowrap; }
      .tr b.good, .cell b.good { color: #15803d; }
      .tr.total { border-top: 2px solid var(--ink); border-bottom: none; }
      .tr.total span { font-weight: 700; color: var(--ink); }
      .split { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--gap) * 0.7); }
      .cell { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: var(--row); padding: 0 0.7em; background: #f1f2f4; min-width: 0; }
      .cell span { font-size: var(--row-label); color: #3b3b42; font-weight: 500; white-space: nowrap; }
      .cell b { font-family: var(--display); font-size: var(--row-val); font-weight: 700; white-space: nowrap; }

      .phone { display: flex; align-items: center; justify-content: center; gap: 0.4em; padding: 0.2em 0.5em; font-family: var(--display); font-size: var(--ten-fig); font-weight: 700; background: var(--ink); color: #fff; }
      .phone.wa { background: #25d366; }
      .phone svg { width: 1em; height: 1em; fill: currentColor; flex-shrink: 0; }
      .foot { display: flex; justify-content: space-between; gap: 20px; font-size: var(--note); color: #77777f; }
      .showroom { font-weight: 700; line-height: 1.35; color: #3b3b42; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* ---- the three sizes ---- */
      .size-square {
        --pad: 44px; --gap: 16px; --eyebrow: 19px; --title: 76px; --logo: 84px;
        --hero: 132px; --hero-label: 27px; --hero-sub: 23px;
        --avatar: 96px; --adv-name: 32px; --adv-role: 20px;
        --ten-h: 68px; --ten-chip: 30px; --ten-fig: 42px;
        --row: 46px; --row-label: 23px; --row-val: 30px; --note: 17px;
      }
      .size-bigNumbers {
        --pad: 56px; --gap: 20px; --eyebrow: 20px; --title: 96px; --logo: 108px;
        --hero: 170px; --hero-label: 34px; --hero-sub: 29px;
        --avatar: 124px; --adv-name: 40px; --adv-role: 24px;
        --ten-h: 86px; --ten-chip: 38px; --ten-fig: 54px;
        --row: 60px; --row-label: 29px; --row-val: 38px; --note: 21px;
      }
      .size-bigCamera {
        --pad: 32px; --gap: 11px; --eyebrow: 16px; --title: 58px; --logo: 64px;
        --hero: 100px; --hero-label: 21px; --hero-sub: 18px;
        --avatar: 74px; --adv-name: 26px; --adv-role: 16px;
        --ten-h: 52px; --ten-chip: 24px; --ten-fig: 33px;
        --row: 35px; --row-label: 18px; --row-val: 23px; --note: 14px;
      }
    `,
  ],
})
export class LiveScreenComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data!: LiveScreenData | null;
  @ViewChild('frame', { static: true }) frame!: ElementRef<HTMLDivElement>;

  scale = signal(1);
  private observer?: ResizeObserver;

  readonly colors = POSTER_COLORS;
  readonly fonts = POSTER_FONTS;

  dims = () => LIVE_SCREEN_SIZES[this.data?.size ?? 'square'];
  t = () => TEXT[this.data?.lang ?? 'ms'];

  constructor() {
    // The posters' own fonts — loaded on demand, so make sure they're in before the first frame.
    posterFontsReady();
  }

  ngAfterViewInit() {
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(this.frame.nativeElement);
    this.fit();
  }

  /** A new size (or first data) changes the shape, not the space — re-fit for it too. */
  ngOnChanges() {
    if (this.frame) queueMicrotask(() => this.fit());
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  /** Scales the fixed-size screen down (or up) to fit the space it's in, keeping its shape. */
  fit() {
    const box = this.frame.nativeElement.getBoundingClientRect();
    const { width, height } = this.dims();
    if (!box.width || !box.height) return;
    this.scale.set(Math.min(box.width / width, box.height / height));
  }

  /** The lowest monthly — the longest tenure, which comes first. */
  lowest(d: LiveScreenData): LiveScreenData['tenures'][number] | null {
    return d.tenures[0] ?? null;
  }

  others(d: LiveScreenData) {
    return d.tenures.slice(1);
  }

  /** The big figure, shrunk only as far as it must be to fit its digits. */
  heroShrink(d: LiveScreenData): number {
    const value = d.cash ? d.sellingPrice : (this.lowest(d)?.monthly ?? 0);
    const digits = Math.round(Math.abs(value)).toString().length;
    return digits >= 7 ? 0.62 : digits >= 6 ? 0.74 : digits >= 5 ? 0.9 : 1;
  }

  /** Whole ringgit with thousands separators — easier to read on stream than cents. */
  n(v: number): string {
    return Math.round(v).toLocaleString('en-MY');
  }

  yearsLabel(row: { years: number; months: number }): string {
    return row.months % 12 === 0 ? this.t().years(row.years) : `${row.months} mo`;
  }
}
