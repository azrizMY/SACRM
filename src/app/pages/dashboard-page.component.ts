import { Component } from '@angular/core';
import { KpiCardsComponent } from '../dashboard/kpi-cards.component';
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
      <app-kpi-cards />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <app-sales-trend-chart />
        <app-units-sold-chart />
        <app-model-performance-chart />
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <app-lead-status-chart />
        <app-top-models />
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="xl:col-span-2">
          <app-recent-deals-table />
        </div>
        <app-recent-leads />
      </div>
    </div>
  `,
})
export class DashboardPageComponent {}
