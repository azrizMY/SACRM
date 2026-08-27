import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="relative">
      <button type="button" class="w-full outline-none" (click)="toggle($event)">
        <ng-content></ng-content>
      </button>

      @if (open) {
        <div
          class="absolute z-50 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          [class]="menuPosition"
        >
          <div class="px-2 py-1.5">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-foreground">{{ advisor.profile().name }}</span>
              <span class="text-xs text-muted-foreground">{{ advisor.profile().email }}</span>
            </div>
          </div>
          <div class="my-1 h-px bg-border"></div>
          <button type="button" (click)="goTo('/profile')" class="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-sm text-foreground transition-colors hover:bg-accent">
            <app-icon name="user" [size]="16" />
            Profile
          </button>
          <button type="button" (click)="goTo('/settings')" class="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-sm text-foreground transition-colors hover:bg-accent">
            <app-icon name="settings" [size]="16" />
            Account settings
          </button>
          <div class="my-1 h-px bg-border"></div>
          <button type="button" (click)="logout()" class="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-sm text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
            <app-icon name="log-out" [size]="16" />
            Log out
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
