import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { SettingsService } from '../shared/settings.service';
import { TranslatePipe } from '../shared/i18n';
import { InstallBannerComponent } from '../shared/install-banner.component';
import { ToastHostComponent } from '../shared/toast-host.component';

const TITLES: Record<string, string> = {
  calculator: 'Calculator',
  compare: 'Compare Cars',
  budget: 'Budget',
  live: 'Live Mode',
  links: 'Quote Links',
  cars: 'Catalog',
  'price-settings': 'Price Settings',
  profile: 'My Profile',
  settings: 'Settings',
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, TranslatePipe, InstallBannerComponent, ToastHostComponent],
  template: `
    <div class="flex h-dvh w-full overflow-hidden">
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
            [attr.aria-label]="'Close menu' | t"
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
        <main class="route-host flex-1 overflow-y-auto p-4 md:p-6">
          @if (active() === 'calculator') {
            <app-install-banner />
          }
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-host />
  `,
})
export class AppShellComponent {
  collapsed = signal(false);
  mobileOpen = signal(false);
  active = signal('calculator');
  title = signal('Calculator');
  /** No page shows a brand beside its title on this branch (main shows it on the Dashboard). */
  titleBrand = computed<string | null>(() => null);

  constructor(
    private router: Router,
    private settings: SettingsService,
  ) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const id = this.currentId();
        this.active.set(id);
        this.title.set(TITLES[id] ?? 'Calculator');
        this.mobileOpen.set(false);
      });
  }

  private currentId(): string {
    const seg = this.router.url.split('?')[0].split('/').filter(Boolean)[0];
    return seg ?? 'calculator';
  }

  navigate(id: string) {
    this.mobileOpen.set(false);
    this.router.navigate([id]);
  }
}
