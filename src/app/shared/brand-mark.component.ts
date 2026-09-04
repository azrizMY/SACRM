import { Component, Input } from '@angular/core';
import { brandInitials, brandLogo, brandStyle } from '../data/dashboard-data';

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  template: `
    @if (logo(); as src) {
      <img [src]="src" [alt]="brand" class="size-7 shrink-0 rounded-md object-cover" [class]="class" />
    } @else {
      <span
        aria-hidden="true"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
        [class]="class"
        [style.backgroundColor]="style.bg"
        [style.color]="style.fg"
      >
        {{ initials }}
      </span>
    }
  `,
})
export class BrandMarkComponent {
  @Input({ required: true }) brand!: string;
  @Input() class = '';

  logo() {
    return brandLogo(this.brand);
  }

  get style() {
    return brandStyle(this.brand);
  }
  get initials() {
    return brandInitials(this.brand);
  }
}
