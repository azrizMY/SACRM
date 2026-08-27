import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { SettingsService } from '../shared/settings.service';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  calculator: 'Calculator',
  cars: 'My Cars',
  leads: 'Customer Manager',
  bankers: 'Bankers',
  'trade-ins': 'Trade-ins',
  notes: 'Cost Breakdown',
  profile: 'My Profile',
  settings: 'Settings',
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="flex h-dvh w-full overflow-hidden bg-background">
      <!-- Desktop sidebar -->
      <div class="hidden md:block">
        <app-sidebar
          [collapsed]="collapsed()"
          [active]="active()"
          (navigate)="navigate($event)"
          (toggle)="collapsed.set(!collapsed())"
        />
      </div>

      <!-- Mobile drawer -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
            (click)="mobileOpen.set(false)"
          ></button>
          <div class="absolute inset-y-0 left-0 animate-slide-in-left">
            <app-sidebar
              [collapsed]="false"
              variant="mobile"
              [active]="active()"
              (navigate)="navigate($event)"
              (toggle)="mobileOpen.set(false)"
            />
          </div>
        </div>
      }

      <!-- Main -->
      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar [title]="title()" [brand]="titleBrand()" (openMobile)="mobileOpen.set(true)" />
        <main class="flex-1 overflow-y-auto p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  collapsed = signal(false);
  mobileOpen = signal(false);
  active = signal('dashboard');
  title = signal('Dashboard');
  /** The Default Brand set in Account Settings, shown beside the title only on the Dashboard page. */
  titleBrand = computed(() => (this.active() === 'dashboard' ? this.settings.settings().dashboardTarget.brand : null));

  constructor(
    private router: Router,
    private settings: SettingsService,
  ) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const id = this.currentId();
        this.active.set(id);
        this.title.set(TITLES[id] ?? 'Dashboard');
      });
  }

  private currentId(): string {
    const seg = this.router.url.split('?')[0].split('/').filter(Boolean)[0];
    return seg ?? 'dashboard';
  }

  navigate(id: string) {
    this.mobileOpen.set(false);
    this.router.navigate([id]);
  }
}
