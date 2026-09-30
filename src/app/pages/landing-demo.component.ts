import { Component, ElementRef, OnDestroy, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { CountUpDirective } from '../shared/count-up.directive';
import { IconComponent } from '../shared/icon.component';

/** The demo is laid out on a fixed 400×620 "screen" and scaled to fit, so the scripted cursor
 *  coordinates below always land on the right controls whatever the viewport. */
const W = 400;

const CARS = [
  { id: 'hatch', label: 'Hatchback', name: 'Hatchback 1.3 Standard', price: 58_800, x: 76 },
  { id: 'sedan', label: 'Sedan', name: 'Sedan 1.5 Premium', price: 98_800, x: 200 },
  { id: 'suv', label: 'SUV', name: 'SUV 1.5T Flagship', price: 128_800, x: 324 },
];
const TENURES = [
  { years: 5, x: 76 },
  { years: 7, x: 200 },
  { years: 9, x: 324 },
];
const RATE = 0.026;
const SLIDER = { left: 20, width: 360, y: 262, maxPct: 50 };
const knobX = (pct: number) => SLIDER.left + (SLIDER.width * pct) / SLIDER.maxPct;

export const DEMO_STEPS = ['Pick a car', 'Set the downpayment', 'Choose the tenure', 'Share it on WhatsApp'];

const rm = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`;

/** Landing page: a scripted cursor builds a quote in a mock calculator, on a loop. */
@Component({
  selector: 'app-landing-demo',
  standalone: true,
  imports: [IconComponent, CountUpDirective],
  template: `
    <div class="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <ol class="order-2 flex flex-col gap-3 md:order-1" aria-label="How a quote is built">
        @for (s of steps; track s; let i = $index) {
          <li
            class="flex items-center gap-4 rounded-2xl border p-4 transition-all duration-500"
            [class]="step() === i ? 'border-primary/40 bg-primary/10' : step() > i ? 'border-border bg-card' : 'border-border bg-card opacity-60'"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold transition-colors duration-500"
              [class]="step() > i ? 'bg-[var(--success)]/15 text-[var(--success)]' : step() === i ? 'logo-chip' : 'bg-muted text-muted-foreground'"
            >
              @if (step() > i) {
                <app-icon name="check" [size]="16" />
              } @else {
                {{ i + 1 }}
              }
            </span>
            <span class="text-sm font-semibold sm:text-base">{{ s }}</span>
          </li>
        }
      </ol>

      <!-- Scaled demo screen -->
      <div #frame class="order-1 mx-auto w-full max-w-[400px] md:order-2" aria-hidden="true">
        <div class="relative" [style.height.px]="620 * scale()">
          <div class="glass glow-border absolute left-0 top-0 origin-top-left overflow-hidden rounded-[28px] border border-border" [style.width.px]="400" [style.height.px]="620" [style.transform]="'scale(' + scale() + ')'">
            <div class="flex h-14 items-center justify-between border-b border-border px-5">
              <span class="text-sm font-bold">Calculator</span>
              <span class="logo-chip flex size-8 items-center justify-center rounded-full text-[11px] font-bold">AR</span>
            </div>

            <div class="absolute left-5 top-[76px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select car</div>
            @for (c of cars; track c.id) {
              <div
                class="absolute top-[94px] flex h-10 w-[112px] -translate-x-1/2 items-center justify-center rounded-xl border text-sm font-semibold transition-colors duration-300"
                [style.left.px]="c.x"
                [class]="car()?.id === c.id ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card'"
              >
                {{ c.label }}
              </div>
            }

            <div class="absolute left-5 right-5 top-[150px] rounded-xl border border-border bg-card px-4 py-3 transition-opacity duration-300" [class.opacity-40]="!car()">
              <p class="text-sm font-bold">{{ car()?.name ?? 'No car selected' }}</p>
              <p class="text-xs text-muted-foreground">{{ car() ? 'OTR ' + rm(car()!.price) : 'Pick a model above' }}</p>
            </div>

            <div class="absolute left-5 right-5 top-[222px] flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Downpayment</span>
              <span class="font-mono normal-case tracking-normal text-foreground">{{ car() ? rm(downpayment()) : '—' }} · {{ dpPct() }}%</span>
            </div>
            <div class="absolute h-1.5 rounded-full bg-muted" [style.left.px]="slider.left" [style.width.px]="slider.width" [style.top.px]="slider.y - 3">
              <div class="h-full rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)]" [style.width.px]="knob() - slider.left"></div>
            </div>
            <div
              class="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow transition-transform duration-150"
              [class.scale-125]="dragging()"
              [style.left.px]="knob()"
              [style.top.px]="slider.y"
            ></div>

            <div class="absolute left-5 top-[290px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tenure</div>
            @for (t of tenures; track t.years) {
              <div
                class="absolute top-[308px] flex h-10 w-[112px] -translate-x-1/2 items-center justify-center rounded-xl border font-mono text-sm font-semibold transition-colors duration-300"
                [style.left.px]="t.x"
                [class]="tenure() === t.years ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card'"
              >
                {{ t.years }} years
              </div>
            }

            <div class="absolute left-5 right-5 top-[370px] rounded-2xl bg-primary/10 px-5 py-4">
              <p class="text-[11px] font-semibold uppercase tracking-wider text-primary">Monthly instalment</p>
              @if (car()) {
                <p class="font-mono text-4xl font-extrabold tabular text-gradient" [appCountUp]="rm(monthly())" [countUpDuration]="500"></p>
              } @else {
                <p class="font-mono text-4xl font-extrabold text-muted-foreground">RM —</p>
              }
              <p class="mt-1 text-xs text-muted-foreground">{{ car() ? 'Loan ' + rm(loan()) + ' · ' + tenure() + ' years · 2.6% p.a.' : 'Set up the loan to see it' }}</p>
            </div>

            <div class="absolute left-5 right-5 top-[492px] flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--success)] text-sm font-bold text-[var(--success-foreground)] transition-transform duration-150" [class.scale-95]="pressed() === 'share'">
              <app-icon name="message-circle" [size]="16" /> Share on WhatsApp
            </div>

            <div
              class="absolute inset-x-5 bottom-5 flex items-center gap-2.5 rounded-xl border border-[var(--success)]/40 bg-card px-4 py-3 text-sm font-semibold shadow-lg transition-all duration-500"
              [class]="sent() ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
            >
              <span class="flex size-6 items-center justify-center rounded-full bg-[var(--success)] text-[var(--success-foreground)]"><app-icon name="check" [size]="14" /></span>
              Quote sent to your customer
            </div>

            <!-- Cursor -->
            @if (!reduced) {
              <div class="pointer-events-none absolute left-0 top-0 z-10" [style.transform]="'translate(' + cursor().x + 'px,' + cursor().y + 'px)'" [style.transition]="'transform ' + moveMs() + 'ms cubic-bezier(0.65,0,0.35,1), opacity 400ms'" [style.opacity]="cursorVisible() ? 1 : 0">
                @if (clickTick() > 0) {
                  @for (k of [clickTick()]; track k) {
                    <span class="demo-ripple absolute -left-4 -top-4 size-8 rounded-full border-2 border-primary"></span>
                  }
                }
                <svg width="22" height="22" viewBox="0 0 24 24" class="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" [class.scale-90]="pressed() !== null">
                  <path d="M4 2.5 20 11l-7 1.8L9.5 20z" fill="white" stroke="black" stroke-width="1.4" stroke-linejoin="round" />
                </svg>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .demo-ripple {
      animation: demo-ripple 0.6s ease-out forwards;
    }
    @keyframes demo-ripple {
      from {
        transform: scale(0.4);
        opacity: 1;
      }
      to {
        transform: scale(1.6);
        opacity: 0;
      }
    }
  `,
})
export class LandingDemoComponent implements OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  readonly cars = CARS;
  readonly tenures = TENURES;
  readonly slider = SLIDER;
  readonly steps = DEMO_STEPS;
  readonly rm = rm;
  readonly reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  scale = signal(1);
  step = signal(-1);
  car = signal<(typeof CARS)[number] | null>(null);
  dpPct = signal(10);
  tenure = signal(7);
  dragging = signal(false);
  pressed = signal<string | null>(null);
  sent = signal(false);
  cursor = signal({ x: 330, y: 560 });
  cursorVisible = signal(false);
  moveMs = signal(0);
  clickTick = signal(0);

  knob = computed(() => knobX(this.dpPct()));
  downpayment = computed(() => (this.car()?.price ?? 0) * (this.dpPct() / 100));
  loan = computed(() => (this.car()?.price ?? 0) - this.downpayment());
  monthly = computed(() => (this.loan() * (1 + RATE * this.tenure())) / (this.tenure() * 12));

  private run = 0;
  private resize?: ResizeObserver;
  private visibility?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const frame = this.frame().nativeElement;
      this.resize = new ResizeObserver(() => this.scale.set(Math.min(1, frame.clientWidth / W)));
      this.resize.observe(frame);
      if (this.reduced) {
        this.showFinalState();
        return;
      }
      this.visibility = new IntersectionObserver(([entry]) => (entry.isIntersecting ? this.play() : this.stop()), { threshold: 0.35 });
      this.visibility.observe(el);
    });
  }

  ngOnDestroy() {
    this.stop();
    this.resize?.disconnect();
    this.visibility?.disconnect();
  }

  private stop() {
    this.run++;
  }

  private async play() {
    const id = ++this.run;
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => setTimeout(() => (id === this.run ? resolve() : reject(new Error('stopped'))), ms));
    const move = async (x: number, y: number, ms: number) => {
      this.moveMs.set(ms);
      this.cursor.set({ x, y });
      await wait(ms);
    };
    const click = async (name: string) => {
      this.pressed.set(name);
      this.clickTick.update((n) => n + 1);
      await wait(160);
      this.pressed.set(null);
    };

    try {
      while (true) {
        this.reset();
        await wait(700);
        this.cursorVisible.set(true);

        this.step.set(0);
        await move(CARS[1].x - 4, 108, 900);
        await click('car');
        this.car.set(CARS[1]);
        await wait(700);

        this.step.set(1);
        await move(knobX(10) - 4, SLIDER.y - 4, 800);
        this.pressed.set('knob');
        this.dragging.set(true);
        this.moveMs.set(0);
        for (let pct = 11; pct <= 30; pct++) {
          this.dpPct.set(pct);
          this.cursor.set({ x: knobX(pct) - 4, y: SLIDER.y - 4 });
          await wait(55);
        }
        this.dragging.set(false);
        this.pressed.set(null);
        await wait(600);

        this.step.set(2);
        await move(TENURES[2].x - 4, 322, 800);
        await click('tenure');
        this.tenure.set(9);
        await wait(900);

        this.step.set(3);
        await move(196, 510, 900);
        await click('share');
        this.sent.set(true);
        this.step.set(4);
        await wait(2800);
        this.cursorVisible.set(false);
        await wait(900);
      }
    } catch {
      /* stopped: scrolled away or destroyed — play() restarts from the top when visible again */
    }
  }

  private reset() {
    this.moveMs.set(0);
    this.cursor.set({ x: 330, y: 560 });
    this.car.set(null);
    this.dpPct.set(10);
    this.tenure.set(7);
    this.sent.set(false);
    this.step.set(-1);
  }

  private showFinalState() {
    this.car.set(CARS[1]);
    this.dpPct.set(30);
    this.tenure.set(9);
    this.step.set(4);
  }
}
