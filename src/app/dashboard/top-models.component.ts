import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { CustomerService } from '../shared/customer.service';
import { topModelsByUnits } from '../data/dashboard-stats';

@Component({
  selector: 'app-top-models',
  standalone: true,
  imports: [CommonModule, BrandMarkComponent],
  template: `
    <div class="flex h-full flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1 px-6">
        <h3 class="font-semibold leading-none">Top 5 best-selling models</h3>
        <p class="text-sm text-muted-foreground">Across all brands this month</p>
      </div>
      <div class="px-6">
        @if (models().length) {
          <ul class="flex flex-col gap-4">
            @for (m of models(); track m.brand + m.model; let i = $index) {
              <li class="flex items-center gap-3">
                <span class="w-4 shrink-0 font-mono text-sm text-muted-foreground tabular">{{ i + 1 }}</span>
                <app-brand-mark [brand]="m.brand" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ m.model }}</p>
                  <div class="mt-1.5 flex items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div class="h-full rounded-full bg-primary" [style.width.%]="(m.units / max()) * 100"></div>
                    </div>
                    <span class="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">{{ m.units }} units</span>
                  </div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="py-6 text-center text-sm text-muted-foreground">No deliveries this month yet.</p>
        }
      </div>
    </div>
  `,
})
export class TopModelsComponent {
  constructor(private customers: CustomerService) {}

  models = computed(() => topModelsByUnits(this.customers.records()));
  max = computed(() => Math.max(1, ...this.models().map((m) => m.units)));
}
