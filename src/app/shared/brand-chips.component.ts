import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';

/**
 * Brand picker as one row of chips (Calculator, Live and the customer quote link). With a few
 * brands they simply fit. With more, the row scrolls sideways, and three things make that obvious
 * to someone who'd never think to swipe: the hidden side fades out, a round arrow button sits on
 * that side (tap it, or use it with a mouse), and the chosen brand is always scrolled into view.
 * Nothing extra shows while everything fits.
 */
@Component({
  selector: 'app-brand-chips',
  standalone: true,
  imports: [NgClass, NgStyle, IconComponent, TranslatePipe],
  styles: `
    .chip-row {
      scrollbar-width: none;
    }
    .chip-row::-webkit-scrollbar {
      display: none;
    }
  `,
  template: `
    <div class="flex items-center gap-1.5">
      @if (canLeft()) {
        <button type="button" (click)="step(-1)" [attr.aria-label]="'Previous brands' | t" class="flex size-8 shrink-0 items-center justify-center rounded-full border border-control bg-card text-foreground transition-colors hover:bg-accent">
          <app-icon name="chevron-left" [size]="18" />
        </button>
      }
      <div
        #row
        role="radiogroup"
        [attr.aria-label]="'Brand' | t"
        (scroll)="measure()"
        class="chip-row flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth"
        [ngStyle]="fadeStyle()"
      >
        @for (b of brands; track b) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="b === selected"
            [attr.data-brand]="b"
            (click)="pick.emit(b)"
            class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors"
            [ngClass]="b === selected ? 'border-brand bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            {{ b }}
          </button>
        }
      </div>
      @if (canRight()) {
        <button type="button" (click)="step(1)" [attr.aria-label]="'More brands' | t" class="flex size-8 shrink-0 items-center justify-center rounded-full border border-control bg-card text-foreground transition-colors hover:bg-accent">
          <app-icon name="chevron-right" [size]="18" />
        </button>
      }
    </div>
  `,
})
export class BrandChipsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) brands: string[] = [];
  @Input({ required: true }) selected = '';
  @Output() pick = new EventEmitter<string>();
  @ViewChild('row') private rowRef?: ElementRef<HTMLDivElement>;

  canLeft = signal(false);
  canRight = signal(false);
  private resize?: ResizeObserver;

  ngAfterViewInit() {
    const row = this.rowRef?.nativeElement;
    if (!row) return;
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(row);
    this.revealSelected(false);
  }

  ngOnChanges() {
    // After the view updates (a new brand chosen elsewhere, or the list changed).
    queueMicrotask(() => this.revealSelected(true));
  }

  ngOnDestroy() {
    this.resize?.disconnect();
  }

  /** Which ends have chips hidden past them. */
  measure() {
    const row = this.rowRef?.nativeElement;
    if (!row) return;
    this.canLeft.set(row.scrollLeft > 2);
    this.canRight.set(row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
  }

  /** The arrow buttons move most of a row-width, leaving a chip of overlap for context. */
  step(dir: 1 | -1) {
    const row = this.rowRef?.nativeElement;
    if (!row) return;
    row.scrollBy({ left: dir * Math.max(80, row.clientWidth * 0.7), behavior: 'smooth' });
  }

  /** Scrolls just this row (never the page) so the chosen chip is fully in view. */
  private revealSelected(smooth: boolean) {
    const row = this.rowRef?.nativeElement;
    if (!row) return;
    const chip = Array.from(row.querySelectorAll<HTMLElement>('[data-brand]')).find((el) => el.dataset['brand'] === this.selected);
    if (chip) {
      const pad = 40;
      const left = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
      const right = left + chip.offsetWidth;
      let target = row.scrollLeft;
      if (left < row.scrollLeft + pad) target = Math.max(0, left - pad);
      else if (right > row.scrollLeft + row.clientWidth - pad) target = right - row.clientWidth + pad;
      if (target !== row.scrollLeft) row.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
    }
    this.measure();
  }

  /** Fades out whichever side still has chips past it. */
  fadeStyle(): Record<string, string> {
    const l = this.canLeft();
    const r = this.canRight();
    if (!l && !r) return {};
    const mask = `linear-gradient(90deg, ${l ? 'transparent 0, #000 28px' : '#000 0'}, ${r ? '#000 calc(100% - 36px), transparent 100%' : '#000 100%'})`;
    return { 'mask-image': mask, '-webkit-mask-image': mask };
  }
}
