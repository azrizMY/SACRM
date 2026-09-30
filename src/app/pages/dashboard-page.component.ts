import { Component } from '@angular/core';
import { KpiCardsComponent } from '../dashboard/kpi-cards.component';
import { SetupChecklistComponent } from '../dashboard/setup-checklist.component';
import { SalesTrendChartComponent } from '../dashboard/sales-trend-chart.component';
import { UnitsSoldChartComponent } from '../dashboard/units-sold-chart.component';
import { ModelPerformanceChartComponent } from '../dashboard/model-performance-chart.component';
import { LeadStatusChartComponent } from '../dashboard/lead-status-chart.component';
import { TopModelsComponent } from '../dashboard/top-models.component';
import { RecentDealsTableComponent } from '../dashboard/recent-deals-table.component';
import { RecentLeadsComponent } from '../dashboard/recent-leads.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    SetupChecklistComponent,
    KpiCardsComponent,
    SalesTrendChartComponent,
    UnitsSoldChartComponent,
    ModelPerformanceChartComponent,
    LeadStatusChartComponent,
    TopModelsComponent,
    RecentDealsTableComponent,
    RecentLeadsComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <app-setup-checklist />
      <app-kpi-cards />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <app-sales-trend-chart style="--i: 5" />
        <app-units-sold-chart style="--i: 6" />
        <app-model-performance-chart style="--i: 7" />
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <app-lead-status-chart style="--i: 8" />
        <app-top-models style="--i: 9" />
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="xl:col-span-2">
          <app-recent-deals-table style="--i: 10" />
        </div>
        <app-recent-leads style="--i: 11" />
      </div>
    </div>
  `,
})
export class DashboardPageComponent {}
