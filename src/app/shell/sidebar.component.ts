import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent, IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { UserMenuComponent } from './user-menu.component';

type NavItem = { id: string; label: string; icon: IconName };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'calculator', label: 'Calculator', icon: 'calculator' },
  { id: 'cars', label: 'My Cars', icon: 'car' },
  { id: 'leads', label: 'Customer Manager', icon: 'users' },
  { id: 'notes', label: 'Cost Breakdown', icon: 'wallet' },
  { id: 'bankers', label: 'Bankers', icon: 'landmark' },
  { id: 'trade-ins', label: 'Trade-ins', icon: 'truck' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent, UserMenuComponent],
  template: `
    <aside
      class="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out"
      [ngClass]="collapsed ? 'w-[72px]' : 'w-60'"
    >
      <!-- Brand -->
      <div
        class="flex h-16 items-center gap-2.5 border-b border-sidebar-border"
        [ngClass]="collapsed ? 'justify-center px-0' : 'px-4'"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <app-icon name="car" [size]="20" />
        </span>
        @if (!collapsed) {
          <div class="flex min-w-0 flex-col leading-tight">
            <span class="truncate text-sm font-semibold tracking-tight">Redline</span>
            <span class="truncate text-[11px] text-muted-foreground">Dealership CRM</span>
          </div>
        }
      </div>

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
          @if (!collapsed) {<span>{{ variant === 'mobile' ? 'Close menu' : 'Collapse' }}</span>}
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
                class="group relative flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors"
                [ngClass]="[
                  collapsed ? 'justify-center px-0' : 'px-2.5',
                  item.id === active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                ]"
              >
                @if (item.id === active) {
                  <span class="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"></span>
                }
                <app-icon
                  [name]="item.icon"
                  [size]="18"
                  [class]="'shrink-0 ' + (item.id === active ? 'text-primary' : '')"
                />
                @if (!collapsed) {
                  <span class="truncate">{{ item.label }}</span>
                }
                @if (!collapsed && badgeFor(item.id); as count) {
                  <span class="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold tabular text-muted-foreground">
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
        <app-user-menu [align]="collapsed ? 'center' : 'start'" side="top">
          <span
            class="flex w-full items-center gap-3 rounded-md text-left transition-colors hover:bg-sidebar-accent"
            [ngClass]="collapsed ? 'justify-center p-1' : 'p-1.5'"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {{ advisor.initials() }}
            </span>
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
