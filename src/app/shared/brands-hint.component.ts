import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';
import { SettingsService } from './settings.service';
import { VehicleCatalogService } from './vehicle-catalog.service';

/**
 * One-time hint on the pages that only show the brands you sell, until Settings → Brands I sell
 * has been chosen once. "Got it" keeps just the Primary Brand and hides the hint for good.
 */
@Component({
  selector: 'app-brands-hint',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    @if (settings.brandsISellUnset() && catalog.brands().length > 1) {
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
        <app-icon name="info" [size]="16" class="shrink-0 text-primary" />
        <span class="min-w-0 flex-1">
          {{ 'Showing {brand} only. Sell other brands too? Add them in' | t: { brand: settings.brandsISell()[0] } }}
          <a routerLink="/settings" class="font-semibold text-primary hover:underline">{{ 'Settings' | t }}</a>.
        </span>
        <button type="button" (click)="dismiss()" class="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {{ 'Got it' | t }}
        </button>
      </div>
    }
  `,
})
export class BrandsHintComponent {
  settings = inject(SettingsService);
  catalog = inject(VehicleCatalogService);

  dismiss() {
    this.settings.updateSalesDefaults({ brandsISell: [] });
  }
}
