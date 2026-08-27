import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type Point = { x: number; y: number };

@Component({
  selector: 'app-sparkline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="h-8 w-full overflow-visible">
      <path [attr.d]="path()" fill="none" [attr.stroke]="color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      @if (lastPoint(); as p) {
        <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.2" [attr.fill]="color" />
      }
    </svg>
  `,
})
export class SparklineComponent {
  @Input({ required: true }) values: number[] = [];
  @Input() color = 'var(--chart-2)';

  // Plain methods, not computed(): values arrives via @Input(), a mutated plain array rather
  // than a signal, so computed() would never see it change after the first render.
  points(): Point[] {
    const vals = this.values;
    if (!vals.length) return [];
    const max = Math.max(...vals, 0);
    const min = Math.min(...vals, 0);
    const range = max - min || 1;
    const n = vals.length;
    return vals.map((v, i) => {
      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
      const y = 30 - ((v - min) / range) * 26 - 2;
      return { x, y };
    });
  }

  path(): string {
    return this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');
  }

  lastPoint(): Point | null {
    const pts = this.points();
    return pts.length ? pts[pts.length - 1] : null;
  }
}
