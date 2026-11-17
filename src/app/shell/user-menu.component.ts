import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { InstallService } from '../shared/install.service';
import { TranslatePipe } from '../shared/i18n';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, IconComponent, TranslatePipe],
  template: `
    <div class="relative">
      <button type="button" class="tap-auto w-full rounded-lg" [attr.aria-expanded]="open" [attr.aria-label]="'Your account' | t" (click)="toggle($event)">
        <ng-content></ng-content>
      </button>

      @if (open) {
        <div
          class="absolute z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
          [class]="menuPosition"
        >
          <div class="flex flex-col px-3 py-2">
            <span class="text-sm font-semibold text-foreground">{{ advisor.profile().name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ advisor.profile().email }}</span>
          </div>
          <div class="my-1 h-px bg-border"></div>
          <button type="button" (click)="goTo('/profile')" class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-accent">
            <app-icon name="user" [size]="18" />
            {{ 'My Profile' | t }}
          </button>
          <button type="button" (click)="goTo('/settings')" class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-accent">
            <app-icon name="settings" [size]="18" />
            {{ 'Settings' | t }}
          </button>
          @if (install.available()) {
            <button type="button" (click)="installApp()" class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-accent">
              <app-icon name="download" [size]="18" />
              {{ 'Install app' | t }}
            </button>
          }
          <div class="my-1 h-px bg-border"></div>
          <button type="button" (click)="logout()" class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
            <app-icon name="log-out" [size]="18" />
            {{ 'Log out' | t }}
          </button>
        </div>
      }
    </div>
  `,
})
export class UserMenuComponent {
  @Input() align: 'start' | 'center' | 'end' = 'end';
  @Input() side: 'top' | 'bottom' = 'bottom';

  open = false;

  constructor(
    private host: ElementRef,
    private router: Router,
    public advisor: AdvisorService,
    private auth: AuthService,
    public install: InstallService,
  ) {}

  goTo(path: string) {
    this.open = false;
    this.router.navigateByUrl(path);
  }

  logout() {
    this.open = false;
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  get menuPosition(): string {
    const vertical =
      this.side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
    const horizontal =
      this.align === 'start'
        ? 'left-0'
        : this.align === 'center'
          ? 'left-1/2 -translate-x-1/2'
          : 'right-0';
    return `${vertical} ${horizontal}`;
  }

  /** Chrome/Android: the real install dialog. iOS: back to the Calculator's install banner, which shows the steps. */
  installApp() {
    this.open = false;
    if (this.install.canPrompt()) {
      this.install.install();
      return;
    }
    this.install.reopenBanner();
    this.router.navigateByUrl('/calculator');
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.open = !this.open;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.open = false;
  }
}
