import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { UserMenuComponent } from './user-menu.component';
import { TranslatePipe } from '../shared/i18n';

type NavItem = { id: string; label: string; icon: IconName };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'calculator', label: 'Calculator', icon: 'calculator' },
  { id: 'cars', label: 'Catalog', icon: 'car' },
  { id: 'price-settings', label: 'Price Settings', icon: 'tag' },
  { id: 'leads', label: 'Customer Manager', icon: 'users' },
  { id: 'notes', label: 'Cost Breakdown', icon: 'wallet' },
  { id: 'bankers', label: 'Bankers', icon: 'landmark' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, UserMenuComponent, TranslatePipe],
  template: `
    <aside
      class="glass flex h-full flex-col border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-300 ease-[var(--ease-out-expo)]"
      [ngClass]="collapsed ? 'w-[72px]' : 'w-60'"
    >
      <!-- Brand -->
      <a
        routerLink="/welcome"
        [title]="'Redline home' | t"
        class="flex h-16 items-center gap-2.5 border-b border-sidebar-border transition-opacity hover:opacity-85"
        [ngClass]="collapsed ? 'justify-center px-0' : 'px-4'"
      >
        <span class="logo-chip flex size-9 shrink-0 items-center justify-center rounded-xl">
          <app-icon name="car" [size]="20" />
        </span>
        @if (!collapsed) {
          <div class="flex min-w-0 flex-col leading-tight">
            <span class="truncate text-sm font-bold tracking-tight">{{ "Redline" | t }}</span>
            <span class="truncate text-[11px] text-muted-foreground">{{ "Dealership CRM" | t }}</span>
          </div>
        }
      </a>

      <!-- Collapse/close toggle -->
      <div class="pt-3" [ngClass]="collapsed ? 'px-0 flex justify-center' : 'px-3'">
        <button
          type="button"
          (click)="toggle.emit()"
          [attr.aria-label]="variant === 'mobile' ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          class="flex items-center gap-2 rounded-md text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          [ngClass]="collapsed ? 'size-9 justify-center p-0' : 'w-full px-2 py-1.5'"
        >
          <app-icon [name]="variant === 'mobile' ? 'x' : 'panel-left'" [size]="16" />
          @if (!collapsed) {<span>{{ variant === 'mobile' ? ('Close menu' | t) : ('Collapse' | t) }}</span>}
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto px-3 py-3">
        <ul class="flex flex-col gap-1">
          @for (item of nav; track item.id) {
            <li>
              <button
                type="button"
                (click)="navigate.emit(item.id)"
                [attr.aria-current]="item.id === active ? 'page' : null"
                [title]="collapsed ? item.label : null"
                class="group relative flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-200"
                [ngClass]="[
                  collapsed ? 'justify-center px-0' : 'px-2.5',
                  item.id === active
                    ? 'text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                ]"
              >
                @if (item.id === active) {
                  <span class="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-primary"></span>
                }
                <app-icon
                  [name]="item.icon"
                  [size]="18"
                  [class]="'shrink-0 transition-transform duration-200 group-hover:scale-110 ' + (item.id === active ? 'text-foreground' : '')"
                />
                @if (!collapsed) {
                  <span class="truncate">{{ item.label | t }}</span>
                }
                @if (!collapsed && badgeFor(item.id); as count) {
                  <span class="logo-chip ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular">
                    {{ count }}
                  </span>
                }
              </button>
            </li>
          }
        </ul>
      </nav>

      <!-- User -->
      <div class="border-t border-sidebar-border p-3">
        <!-- Always 'start' — the rail sits flush against the viewport's left edge, so centering
             the menu on a collapsed (narrow, near x=0) trigger pushed half of it off-screen. -->
        <app-user-menu align="start" side="top">
          <span
            class="flex w-full items-center gap-3 rounded-md text-left transition-colors hover:bg-sidebar-accent"
            [ngClass]="collapsed ? 'justify-center p-1' : 'p-1.5'"
          >
            @if (advisor.profile().photoUrl; as photo) {
              <img [src]="photo" alt="" class="size-8 shrink-0 rounded-full border border-border object-cover" />
            } @else {
              <span class="logo-chip flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {{ advisor.initials() }}
              </span>
            }
            @if (!collapsed) {
              <span class="flex min-w-0 flex-1 flex-col leading-tight">
                <span class="truncate text-sm font-medium text-foreground">{{ advisor.profile().name }}</span>
                <span class="truncate text-[11px] text-muted-foreground">{{ advisor.profile().role }}</span>
              </span>
              <app-icon name="chevron-down" [size]="16" class="shrink-0 text-muted-foreground" />
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

  nav = NAV;

  constructor(
    private customers: CustomerService,
    public advisor: AdvisorService,
  ) {}

  badgeFor(id: string): number | null {
    if (id !== 'leads') return null;
    const count = this.customers.leads().length;
    return count > 0 ? count : null;
  }
}
