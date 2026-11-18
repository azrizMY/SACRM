import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { GUIDES, GuideService } from '../shared/guide.service';
import { IconComponent } from '../shared/icon.component';
import { InstallService } from '../shared/install.service';
import { LinkActivityService } from '../shared/link-activity.service';
import { TranslatePipe } from '../shared/i18n';
import { InstallBannerComponent } from '../shared/install-banner.component';
import { ToastHostComponent } from '../shared/toast-host.component';
import { type PageId } from '../shared/ui-prefs.service';

const TITLES: Record<string, string> = {
  calculator: 'Calculator',
  compare: 'Compare Cars',
  budget: 'Budget',
  live: 'Live Mode',
  links: 'Quote Links',
  cars: 'Catalog',
  'price-settings': 'Price Settings',
  'manage-cars': 'Manage Cars',
  profile: 'My Profile',
  settings: 'Settings',
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, IconComponent, TranslatePipe, InstallBannerComponent, ToastHostComponent],
  template: `
    <div class="flex h-dvh w-full overflow-hidden">
      <!-- Computer / tablet: the menu rail -->
      <div class="hidden md:block">
        <app-sidebar [collapsed]="collapsed()" [active]="active()" (toggle)="collapsed.set(!collapsed())" />
      </div>

      <!-- Phone: the same menu slides in from the left (hamburger button in the top bar) -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-50 md:hidden">
          <button type="button" [attr.aria-label]="'Close menu' | t" class="absolute inset-0 bg-black/60" (click)="mobileOpen.set(false)"></button>
          <div class="animate-slide-in-left absolute inset-y-0 left-0">
            <app-sidebar variant="mobile" [active]="active()" (navigate)="mobileOpen.set(false)" (toggle)="mobileOpen.set(false)" />
          </div>
        </div>
      }

      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar [title]="title()" (openMobile)="mobileOpen.set(true)" />
        <main class="route-host flex-1 overflow-y-auto p-4 md:p-6">
          @if (active() === 'calculator') {
            <app-install-banner />
          }
          <router-outlet />
        </main>
      </div>
    </div>

    <!-- Help: what this page is for, how to use it, and the first steps for a new account -->
    @if (guide.helpOpen()) {
      <div class="fixed inset-0 z-50">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/60" (click)="guide.helpOpen.set(false)"></button>
        <div
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'Help' | t"
          class="animate-slide-up absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl bg-card text-card-foreground md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:animate-none md:rounded-none md:border-l md:border-border"
        >
          <div class="flex items-center gap-3 border-b border-border px-5 py-3">
            <span class="flex min-w-0 flex-1 flex-col leading-tight">
              <span class="text-sm font-semibold text-muted-foreground">{{ 'Help' | t }}</span>
              <h2 class="truncate text-base font-semibold">{{ title() | t }}</h2>
            </span>
            <button type="button" (click)="guide.helpOpen.set(false)" class="btn btn-outline">
              <app-icon name="x" [size]="18" />
              {{ 'Close' | t }}
            </button>
          </div>

          <div class="flex flex-col gap-6 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p class="text-pretty text-base leading-relaxed">{{ pageGuide().about | t }}</p>

            <div class="flex flex-col gap-3">
              <h3 class="text-base font-bold">{{ 'How it works' | t }}</h3>
              <ol class="flex flex-col gap-3">
                @for (step of guide.stepsOnScreen(pageGuide().steps); track step.title; let i = $index) {
                  <li class="flex gap-3">
                    <span class="hl-solid flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">{{ i + 1 }}</span>
                    <span class="flex flex-col gap-0.5 pt-0.5">
                      <span class="text-sm font-semibold">{{ step.title | t }}</span>
                      <span class="text-pretty text-sm leading-relaxed text-muted-foreground">{{ step.body | t }}</span>
                    </span>
                  </li>
                }
              </ol>
              @if (guide.hasTour(pageId())) {
                <button type="button" (click)="guide.startTour(pageId())" class="btn btn-primary mt-1">
                  <app-icon name="eye" [size]="20" />
                  {{ 'Show me on the screen' | t }}
                </button>
              }
            </div>

            <div class="flex flex-col gap-2 border-t border-border pt-5">
              <button type="button" (click)="replayWelcome()" class="flex min-h-12 items-center gap-3 rounded-lg border border-border px-4 text-left text-base font-semibold transition-colors hover:bg-accent">
                <app-icon name="sparkles" [size]="20" />
                {{ 'Show the welcome guide again' | t }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- First run: say what Redline does and offer to show it -->
    @if (guide.welcomeOpen()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div class="absolute inset-0 bg-black/70"></div>
        <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" class="animate-slide-up relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-2xl bg-card p-6 text-card-foreground sm:animate-none sm:rounded-2xl">
          <div class="flex flex-col gap-2">
            <h2 id="welcome-title" class="text-2xl font-bold tracking-tight">{{ 'Welcome to Redline' | t }}</h2>
            <p class="text-pretty text-base leading-relaxed text-muted-foreground">{{ 'Answer "how much a month?" in seconds, then send it to your customer.' | t }}</p>
          </div>

          <ol class="flex flex-col gap-3">
            @for (line of welcomeLines; track line.title; let i = $index) {
              <li class="flex items-start gap-3">
                <span class="hl-solid flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">{{ i + 1 }}</span>
                <span class="flex flex-col pt-0.5">
                  <span class="text-base font-semibold leading-snug">{{ line.title | t }}</span>
                  <span class="text-sm text-muted-foreground">{{ line.body | t }}</span>
                </span>
              </li>
            }
          </ol>

          <div class="flex flex-col gap-2">
            <button type="button" (click)="showMeAround()" class="btn btn-primary btn-lg">
              {{ 'Show me around' | t }}
              <app-icon name="chevron-right" [size]="20" />
            </button>
            <button type="button" (click)="guide.dismissWelcome()" class="btn text-muted-foreground">
              {{ "I'll look around myself" | t }}
            </button>
          </div>
          <p class="flex items-center gap-2 text-sm text-muted-foreground">
            <app-icon name="help-circle" [size]="18" />
            {{ 'You can open this again any time from Help at the top of the screen.' | t }}
          </p>
        </div>
      </div>
    }

    <app-toast-host />
  `,
})
export class AppShellComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  guide = inject(GuideService);
  advisor = inject(AdvisorService);
  activity = inject(LinkActivityService);
  install = inject(InstallService);

  collapsed = signal(false);
  mobileOpen = signal(false);
  active = signal('calculator');
  title = signal('Calculator');


  pageId = computed<PageId>(() => (this.active() in GUIDES ? (this.active() as PageId) : 'calculator'));
  pageGuide = computed(() => GUIDES[this.pageId()]);

  welcomeLines = [
    { title: 'Pick the car', body: 'The price, rebate and insurance fill in for you.' },
    { title: 'Check the monthly instalment', body: 'Change the deposit or the loan years and it updates straight away.' },
    { title: 'Save or share the poster', body: 'Send it on WhatsApp, or save it to your phone.' },
  ];

  constructor() {
    this.sync();
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      this.sync();
      this.mobileOpen.set(false);
      this.guide.helpOpen.set(false);
    });
    this.guide.maybeWelcome();
  }

  private sync() {
    const seg = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? 'calculator';
    this.active.set(seg);
    this.title.set(TITLES[seg] ?? 'Calculator');
  }

  /** The welcome's main button: go to the Calculator and point at each part of it. */
  async showMeAround() {
    this.guide.dismissWelcome();
    if (this.active() !== 'calculator') await this.router.navigateByUrl('/calculator');
    setTimeout(() => void this.guide.startTour('calculator'), 350);
  }

  replayWelcome() {
    this.guide.helpOpen.set(false);
    this.guide.welcomeOpen.set(true);
  }

  logout() {
    this.mobileOpen.set(false);
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  /** Chrome/Android: the real install dialog. iOS: the Calculator's install banner, which shows the steps. */
  installApp() {
    this.mobileOpen.set(false);
    if (this.install.canPrompt()) {
      void this.install.install();
      return;
    }
    this.install.reopenBanner();
    this.router.navigateByUrl('/calculator');
  }
}
