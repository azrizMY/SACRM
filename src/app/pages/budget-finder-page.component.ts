import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../shared/i18n';
import { BudgetFinderComponent, type BudgetPick } from '../shared/budget-finder.component';
import type { BudgetRules } from '../shared/budget-finder';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { CompareService } from '../shared/compare.service';

/**
 * Budget Finder for the advisor: the same finder customers get on the quote link, with the
 * advisor's own prices and rates — for the "I can pay about RM 900 a month, what can I get?"
 * conversation. Picking a car opens it in the Calculator at that deposit and loan period.
 */
@Component({
  selector: 'app-budget-finder-page',
  standalone: true,
  imports: [TranslatePipe, BudgetFinderComponent],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-bold tracking-tight">{{ 'Budget' | t }}</h2>
        <p class="text-pretty text-sm text-muted-foreground">{{ 'Start from the monthly your customer can manage and see the deposit every car needs. Your customers get the same on your quote link.' | t }}</p>
      </div>
      <app-budget-finder [vehicles]="catalog.vehicles()" [brands]="catalog.brands()" [primaryBrand]="primaryBrand()" [rules]="rules()" openLabel="Open in Calculator" (pick)="open($event)" />
    </div>
  `,
})
export class BudgetFinderPageComponent {
  catalog = inject(VehicleCatalogService);
  private settings = inject(SettingsService);
  private compare = inject(CompareService);
  private router = inject(Router);

  primaryBrand = computed(() => this.settings.settings().dashboardTarget.brand);

  rules = computed<BudgetRules>(() => {
    const d = this.settings.settings().salesDefaults;
    return {
      defaultRateType: d.defaultRateType,
      interestRate: d.interestRate,
      effectiveRate: d.effectiveRate,
      basicPremiumRatePct: d.basicPremiumRatePct,
      ncd: d.ncd,
      loanRounding: d.loanRounding,
      insuranceFor: (vehicle, fallback) => this.settings.getVehicleInsurance(vehicle, fallback),
    };
  });

  open(pick: BudgetPick) {
    this.compare.openInCalculator(pick.vehicleId, pick.year, { deposit: pick.deposit, tenureYears: pick.tenureYears });
    this.router.navigateByUrl('/calculator');
  }
}
