import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { TourService, findTourTarget } from './tour.service';

type Box = { top: number; left: number; width: number; height: number };

/** Dims the page, rings the element a tour step points at, and shows the step card next to it.
 *  Mounted once at the app root so both the signed-in app and the public quote page can use it. */
@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (tour.step(); as step) {
      <div class="fixed inset-0 z-[100]" (click)="$event.stopPropagation()">
        @if (box(); as b) {
          <div
            class="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200"
            [style.top.px]="b.top - 6"
            [style.left.px]="b.left - 6"
            [style.width.px]="b.width + 12"
            [style.height.px]="b.height + 12"
            style="box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.78)"
          ></div>
        } @else {
          <div class="absolute inset-0 bg-black/80"></div>
        }

        <div
          #card
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="step.title"
          class="fixed flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl"
          [style.width.px]="cardWidth()"
          [style.top.px]="pos().top"
          [style.left.px]="pos().left"
        >
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-sm font-semibold leading-snug">{{ step.title }}</h2>
            <button
              type="button"
              (click)="tour.finish()"
              class="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Skip tutorial"
            >
              <app-icon name="x" [size]="15" />
            </button>
          </div>
          <p class="text-pretty text-sm leading-relaxed text-muted-foreground">{{ step.body }}</p>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1" aria-hidden="true">
              @for (i of dots(); track i) {
                <span class="h-1.5 rounded-full transition-all" [ngClass]="i === tour.index() ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/40'"></span>
              }
            </div>
            <div class="flex items-center gap-2">
              @if (tour.index() > 0) {
                <button type="button" (click)="tour.back()" class="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Back</button>
              } @else {
                <button type="button" (click)="tour.finish()" class="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Skip</button>
              }
              <button
                #primary
                type="button"
                (click)="tour.next()"
                class="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {{ tour.isLast() ? (step.doneLabel ?? 'Got it') : 'Next' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class TourOverlayComponent implements OnInit, OnDestroy {
  tour = inject(TourService);
  private zone = inject(NgZone);

  @ViewChild('card') cardRef?: ElementRef<HTMLElement>;
  @ViewChild('primary') primaryRef?: ElementRef<HTMLButtonElement>;

  box = signal<Box | null>(null);
  pos = signal({ top: 0, left: 0 });
  cardWidth = signal(340);
  private frame = 0;
  private scrolledFor = -1;

  constructor() {
    // A new step: scroll its target into view once, and put focus on Next for keyboard users.
    effect(() => {
      const step = this.tour.step();
      const index = this.tour.index();
      if (!step) {
        this.scrolledFor = -1;
        return;
      }
      if (this.scrolledFor !== index) {
        this.scrolledFor = index;
        const el = step.target ? findTourTarget(step.target) : null;
        el?.scrollIntoView({ block: 'center', behavior: 'auto' });
        setTimeout(() => this.primaryRef?.nativeElement.focus(), 0);
      }
    });
  }

  ngOnInit() {
    // Re-measure every frame while a tour is up: the target can move (scrolling, layout shifts,
    // a drawer sliding in), and this is far simpler than chasing every event that could cause it.
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        if (this.tour.isActive()) this.zone.run(() => this.measure());
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
  }

  dots() {
    return Array.from({ length: this.tour.total() }, (_, i) => i);
  }

  private measure() {
    const step = this.tour.step();
    if (!step) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(340, vw - 24);
    if (this.cardWidth() !== width) this.cardWidth.set(width);
    const cardH = this.cardRef?.nativeElement.offsetHeight ?? 170;

    const el = step.target ? findTourTarget(step.target) : null;
    if (!el) {
      if (this.box()) this.box.set(null);
      this.setPos(Math.max(12, (vh - cardH) / 2), Math.max(12, (vw - width) / 2));
      return;
    }
    const r = el.getBoundingClientRect();
    const prev = this.box();
    if (!prev || prev.top !== r.top || prev.left !== r.left || prev.width !== r.width || prev.height !== r.height) {
      this.box.set({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const gap = 14;
    let top: number;
    if (vh - r.bottom >= cardH + gap + 12) top = r.bottom + gap;
    else if (r.top >= cardH + gap + 12) top = r.top - cardH - gap;
    else top = r.top > vh / 2 ? 12 : vh - cardH - 12; // target too tall: dock away from it
    const left = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), vw - width - 12);
    this.setPos(top, left);
  }

  private setPos(top: number, left: number) {
    const p = this.pos();
    if (Math.abs(p.top - top) > 0.5 || Math.abs(p.left - left) > 0.5) this.pos.set({ top, left });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (!this.tour.isActive()) return;
    if (event.key === 'Escape') this.tour.finish();
    else if (event.key === 'ArrowRight') this.tour.next();
    else if (event.key === 'ArrowLeft') this.tour.back();
  }
}
