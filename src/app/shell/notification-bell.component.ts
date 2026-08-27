import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { NotificationService } from '../shared/notification.service';

/** Bell + dropdown panel, mirroring UserMenuComponent's self-contained toggle/click-outside pattern. */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="relative">
      <button
        type="button"
        aria-label="Notifications"
        (click)="toggle($event)"
        class="relative flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
      >
        <app-icon name="bell" [size]="20" />
        @if (notifications.urgentCount() > 0) {
          <span
            class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
          >
            {{ badgeLabel() }}
          </span>
        }
      </button>

      @if (open) {
        <div class="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div class="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</div>
          <div class="max-h-96 overflow-y-auto">
            @for (item of notifications.items(); track item.id) {
              <button
                type="button"
                (click)="openItem()"
                class="flex w-full flex-col gap-0.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent"
              >
                <span class="text-sm font-medium text-foreground">{{ item.title }}</span>
                <span class="text-xs text-muted-foreground">{{ item.detail }}</span>
              </button>
            } @empty {
              <p class="px-3 py-6 text-center text-xs text-muted-foreground">You're all caught up.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificationBellComponent {
  open = false;

  constructor(
    private host: ElementRef,
    private router: Router,
    public notifications: NotificationService,
  ) {}

  badgeLabel(): string {
    const n = this.notifications.urgentCount();
    return n > 9 ? '9+' : String(n);
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.open = !this.open;
  }

  /** Every notification is a customer-record event, so they all resolve to the same place for now. */
  openItem() {
    this.open = false;
    this.router.navigateByUrl('/leads');
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
