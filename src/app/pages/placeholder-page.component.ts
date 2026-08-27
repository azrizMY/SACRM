import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

const TITLES: Record<string, string> = {
  calculator: 'Calculator',
  cars: 'My Cars',
  leads: 'Leads',
  notes: 'Notes',
  settings: 'Settings',
};

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  template: `
    <div class="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
      <p class="text-lg font-semibold">{{ title }}</p>
      <p class="max-w-sm text-sm text-muted-foreground text-pretty">
        This section is part of the CRM. The Dashboard is fully built out — select
        Dashboard from the sidebar to explore it.
      </p>
    </div>
  `,
})
export class PlaceholderPageComponent {
  title = 'Page';

  constructor(route: ActivatedRoute) {
    const id = route.snapshot.data['id'] as string;
    this.title = TITLES[id] ?? 'Page';
  }
}
