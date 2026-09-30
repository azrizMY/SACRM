import { Directive, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';

/**
 * Renders a display string (e.g. "RM 12,345.00" or "3 units") and animates its first number
 * counting up from the previously shown value. Prefix/suffix text and the number's decimal
 * places and thousands separators are preserved. Skips the animation for reduced motion.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input({ required: true }) appCountUp = '';
  @Input() countUpDuration = 900;

  private frame = 0;
  private shown = 0;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges() {
    cancelAnimationFrame(this.frame);
    const text = this.appCountUp ?? '';
    const match = /-?\d[\d,]*(\.\d+)?/.exec(text);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!match || reduce) {
      this.el.nativeElement.textContent = text;
      if (match) this.shown = parseFloat(match[0].replace(/,/g, ''));
      return;
    }

    const target = parseFloat(match[0].replace(/,/g, ''));
    const decimals = match[1] ? match[1].length - 1 : 0;
    const grouped = match[0].includes(',');
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const from = this.shown;
    const start = performance.now();

    const format = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });

    const tick = (now: number) => {
      // A frame's timestamp can predate `start` (it marks the frame's beginning), so clamp at 0 too —
      // a negative t would overshoot wildly through the easing curve.
      const t = Math.min(1, Math.max(0, (now - start) / this.countUpDuration));
      const eased = 1 - Math.pow(1 - t, 4);
      const value = from + (target - from) * eased;
      this.el.nativeElement.textContent = t < 1 ? before + format(value) + after : text;
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };
    this.shown = target;
    this.frame = requestAnimationFrame(tick);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
  }
}
