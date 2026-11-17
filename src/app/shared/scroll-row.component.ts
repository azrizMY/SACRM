import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';

/**
 * One sideways-scrolling row of cards (a model's variants in Catalog and on the customer link).
 * Cards are sized by the page so the next one peeks in at the edge; on top of that, the hidden side
 * fades out and a round arrow button sits over it — for mouse users, and for anyone who wouldn't
 * think to swipe. Nothing extra shows while every card fits.
 *
 * Usage: <app-scroll-row> with the cards as direct children; give each card its width
 * (e.g. w-[44%] sm:w-[30%]) and `shrink-0 snap-start`.
 */
@Component({
  selector: 'app-scroll-row',
  standalone: true,
  imports: [NgStyle, IconComponent, TranslatePipe],
  host: { class: 'block' },
  styles: `
    .track {
      scrollbar-width: none;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
  `,
  template: `
    <div class="relative">
      <div
        #track
        (scroll)="measure()"
        class="track flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth"
        [ngStyle]="fadeStyle()"
      >
        <ng-content />
      </div>
      @if (canLeft()) {
        <button type="button" (click)="step(-1)" [attr.aria-label]="'Previous' | t" class="absolute left-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-control bg-card/95 text-foreground shadow-md transition-colors hover:bg-accent">
          <app-icon name="chevron-left" [size]="20" />
        </button>
      }
      @if (canRight()) {
        <button type="button" (click)="step(1)" [attr.aria-label]="'More' | t" class="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-control bg-card/95 text-foreground shadow-md transition-colors hover:bg-accent">
          <app-icon name="chevron-right" [size]="20" />
        </button>
      }
    </div>
  `,
})
export class ScrollRowComponent implements AfterViewInit, OnDestroy {
  @ViewChild('track') private trackRef?: ElementRef<HTMLDivElement>;
  canLeft = signal(false);
  canRight = signal(false);
  private resize?: ResizeObserver;

  ngAfterViewInit() {
    const track = this.trackRef?.nativeElement;
    if (!track) return;
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(track);
    this.measure();
  }

  ngOnDestroy() {
    this.resize?.disconnect();
  }

  measure() {
    const t = this.trackRef?.nativeElement;
    if (!t) return;
    this.canLeft.set(t.scrollLeft > 2);
    this.canRight.set(t.scrollLeft + t.clientWidth < t.scrollWidth - 2);
  }

  /** Moves by about one row-width, so the arrows page through the cards. */
  step(dir: 1 | -1) {
    const t = this.trackRef?.nativeElement;
    if (!t) return;
    t.scrollBy({ left: dir * Math.max(160, t.clientWidth * 0.85), behavior: 'smooth' });
  }

  /** A soft fade on whichever side still has cards past it. */
  fadeStyle(): Record<string, string> {
    const l = this.canLeft();
    const r = this.canRight();
    if (!l && !r) return {};
    const mask = `linear-gradient(90deg, ${l ? 'transparent 0, #000 24px' : '#000 0'}, ${r ? '#000 calc(100% - 24px), transparent 100%' : '#000 100%'})`;
    return { 'mask-image': mask, '-webkit-mask-image': mask };
  }
}
