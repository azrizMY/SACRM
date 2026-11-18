import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { UserMenuComponent } from './user-menu.component';
import { SetupProgressComponent } from './setup-progress.component';
import { TranslatePipe } from '../shared/i18n';
import { LinkActivityService } from '../shared/link-activity.service';
import { MENU_PAGES, PAGES } from '../shared/ui-prefs.service';

/** The menu: a rail on the left on a computer or tablet, and the same menu sliding in from the
 *  left (opened with the hamburger button) on a phone. Every item has its name. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, UserMenuComponent, SetupProgressComponent, TranslatePipe],
  template: `
    <aside
      class="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-[var(--ease-out-expo)]"
      [ngClass]="collapsed ? 'w-[72px]' : variant === 'mobile' ? 'w-[min(18rem,86vw)]' : 'w-60'"
    >
      <!-- Brand, and on a phone the close button -->
      <div class="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border md:h-16" [ngClass]="collapsed ? 'justify-center px-0' : 'pl-4 pr-2'">
        <a routerLink="/welcome" [attr.aria-label]="'Redline home' | t" class="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-85">
          <span class="logo-chip flex size-9 shrink-0 items-center justify-center rounded-xl">
            <app-icon name="car" [size]="20" />
          </span>
          @if (!collapsed) {
            <span class="flex min-w-0 flex-col leading-tight">
              <span class="truncate text-sm font-bold tracking-tight">Redline</span>
              <span class="truncate text-xs text-sidebar-muted">{{ "Car Quotation" | t }}</span>
            </span>
          }
        </a>
        @if (variant === 'mobile') {
          <button type="button" (click)="toggle.emit()" [attr.aria-label]="'Close menu' | t" class="ml-auto flex size-10 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <app-icon name="x" [size]="20" />
          </button>
        }
      </div>

      <!-- Menu -->
      <nav data-tour="nav-menu" class="flex-1 overflow-y-auto px-3 py-3" [attr.aria-label]="'Main menu' | t">
        <ul class="flex flex-col gap-0.5">
          @for (item of visibleNav(); track item.id) {
            <li>
              <!-- Real links, so a page can be opened in a new tab (Ctrl-click, long-press) -->
              <a
                [routerLink]="'/' + item.id"
                (click)="navigate.emit(item.id)"
                [attr.aria-current]="item.id === active ? 'page' : null"
                [attr.aria-label]="collapsed ? (item.label | t) : null"
                [attr.title]="collapsed ? (item.label | t) : null"
                class="relative flex min-h-11 w-full items-center gap-3 rounded-lg text-sm transition-colors"
                [ngClass]="[
                  collapsed ? 'justify-center px-0' : 'px-3',
                  item.id === active
                    ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                    : 'font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                ]"
              >
                @if (item.id === active) {
                  <span class="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-primary" aria-hidden="true"></span>
                }
                <app-icon [name]="item.icon" [size]="19" [class]="item.id === active ? 'text-[var(--shell-accent)]' : ''" />
                @if (!collapsed) {
                  <span class="truncate">{{ item.label | t }}</span>
                }
                @if (item.id === 'links' && activity.unseen() > 0) {
                  <span
                    class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
                    [ngClass]="collapsed ? 'absolute right-1 top-1' : 'ml-auto'"
                    [attr.aria-label]="'{n} new visits' | t: { n: activity.unseen() }"
                  >{{ activity.unseen() > 99 ? '99+' : activity.unseen() }}</span>
                }
              </a>
            </li>
          }
        </ul>
      </nav>

      <app-setup-progress [collapsed]="collapsed" [variant]="variant" />

      <!-- Narrow / wide (computer only) -->
      @if (variant === 'desktop') {
        <div class="px-3 pb-2">
          <button
            type="button"
            (click)="toggle.emit()"
            [attr.aria-label]="collapsed ? ('Show menu names' | t) : ('Hide menu names' | t)"
            class="flex min-h-10 w-full items-center gap-3 rounded-lg text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            [ngClass]="collapsed ? 'justify-center px-0' : 'px-3'"
          >
            <app-icon name="panel-left" [size]="18" />
            @if (!collapsed) {<span>{{ 'Make menu narrow' | t }}</span>}
          </button>
        </div>
      }

      <!-- Account -->
      <div class="border-t border-sidebar-border p-3">
        <app-user-menu align="start" side="top">
          <span
            class="flex w-full items-center gap-3 rounded-lg text-left transition-colors hover:bg-sidebar-accent"
            [ngClass]="collapsed ? 'justify-center p-1' : 'p-1.5'"
          >
            @if (advisor.profile().photoUrl; as photo) {
              <img [src]="photo" alt="" class="size-9 shrink-0 rounded-full object-cover" />
            } @else {
              <span class="logo-chip flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {{ advisor.initials() }}
              </span>
            }
            @if (!collapsed) {
              <span class="flex min-w-0 flex-1 flex-col leading-tight">
                <span class="truncate text-sm font-semibold text-sidebar-foreground">{{ advisor.profile().name }}</span>
                <span class="truncate text-xs text-sidebar-muted">{{ advisor.profile().role }}</span>
              </span>
              <app-icon name="chevron-down" [size]="16" class="text-sidebar-muted" />
            }
          </span>
        </app-user-menu>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() variant: 'desktop' | 'mobile' = 'desktop';
  @Input({ required: true }) active!: string;
  @Output() navigate = new EventEmitter<string>();
  @Output() toggle = new EventEmitter<void>();

  /** The work pages. My Profile, Settings and Log out live in the account menu at the bottom. */
  nav = MENU_PAGES.map((id) => PAGES.find((p) => p.id === id)!);
  private auth = inject(AuthService);
  /** Manage Cars (owner only) lives in the account menu with My Profile and Settings. */
  visibleNav = computed<{ id: string; label: string; icon: IconName }[]>(() => this.nav);

  activity = inject(LinkActivityService);
  advisor = inject(AdvisorService);
}
