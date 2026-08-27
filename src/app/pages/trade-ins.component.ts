import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent, type IconName } from '../shared/icon.component';
import { TradeInService } from '../shared/trade-in.service';
import { MALAYSIAN_STATES, usernameDisplay, whatsAppHref, normalizeUsername } from '../data/banker-data';
import { canSubmitTradeInContact, type NewTradeInContactInput, type TradeInContactRecord } from '../data/trade-in-data';

type Tab = 'All' | 'Favourites';
type ModalKind = 'add' | 'edit' | null;
type SortKey = 'name' | 'company' | 'state';
type SortDir = 'asc' | 'desc';

type TradeInContactForm = {
  name: string;
  phone: string;
  username: string;
  company: string;
  state: string;
  branch: string;
  notes: string;
};

const EMPTY_FORM: TradeInContactForm = { name: '', phone: '', username: '@', company: '', state: MALAYSIAN_STATES[0], branch: '', notes: '' };

function compareContacts(a: TradeInContactRecord, b: TradeInContactRecord, key: SortKey, dir: SortDir): number {
  const cmp = a[key].localeCompare(b[key]);
  return dir === 'asc' ? cmp : -cmp;
}

@Component({
  selector: 'app-trade-ins',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 pb-16">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-balance text-xl font-semibold tracking-tight">Trade-ins</h2>
          <p class="text-pretty text-sm text-muted-foreground">Your used-car trade-in contacts, filterable by state and company — star the ones you work with most.</p>
        </div>
        <button
          type="button"
          (click)="openAdd()"
          class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <app-icon name="plus" [size]="14" />
          Add Contact
        </button>
      </div>

      <!-- Tabs + search -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Favourites filter" class="flex flex-wrap items-center gap-1.5">
          @for (t of tabs; track t) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="t === activeTab()"
              (click)="selectTab(t)"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="
                t === activeTab()
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              "
            >
              {{ t }} ({{ countFor(t) }})
            </button>
          }
        </div>
        <div class="relative w-full sm:w-64">
          <app-icon name="search" [size]="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Name or branch…"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            class="h-9 w-full rounded-md border border-input bg-input pl-8 pr-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">State</span>
            <select
              [ngModel]="stateFilter()"
              (ngModelChange)="stateFilter.set($event)"
              class="h-9 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="All">All States</option>
              @for (s of states; track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Company</span>
            @if (companies().length > 0) {
              <div class="flex flex-wrap gap-1.5">
                @for (c of companies(); track c) {
                  <button
                    type="button"
                    (click)="toggleCompanyFilter(c)"
                    class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                    [ngClass]="
                      selectedCompanies().has(c)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    "
                  >
                    {{ c }}
                  </button>
                }
              </div>
            } @else {
              <span class="text-xs text-muted-foreground">No companies yet</span>
            }
          </div>
        </div>
        @if (hasActiveFilters()) {
          <div class="flex justify-end">
            <button
              type="button"
              (click)="clearFilters()"
              class="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="x" [size]="12" />
              Clear filters
            </button>
          </div>
        }
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full caption-bottom text-sm">
            <thead>
              <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th class="h-10 whitespace-nowrap px-4 align-middle text-left">
                  <button type="button" (click)="toggleSort('name')" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="sortKey() === 'name' ? 'text-foreground' : 'text-muted-foreground'">
                    Contact
                    <app-icon [name]="sortIcon('name')" [size]="14" class="opacity-70" />
                  </button>
                </th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-left">
                  <button type="button" (click)="toggleSort('company')" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="sortKey() === 'company' ? 'text-foreground' : 'text-muted-foreground'">
                    Company
                    <app-icon [name]="sortIcon('company')" [size]="14" class="opacity-70" />
                  </button>
                </th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-left">
                  <button type="button" (click)="toggleSort('state')" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="sortKey() === 'state' ? 'text-foreground' : 'text-muted-foreground'">
                    State
                    <app-icon [name]="sortIcon('state')" [size]="14" class="opacity-70" />
                  </button>
                </th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-left">Branch</th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (c of filteredSorted(); track c.id) {
                <tr class="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                  <td class="p-4 align-middle">
                    <div class="flex flex-col">
                      <span class="font-medium">{{ c.name }}</span>
                      @if (chatHref(c); as href) {
                        <a [href]="href" target="_blank" rel="noopener" class="text-xs text-primary hover:underline">{{ primaryContact(c) }}</a>
                      } @else {
                        @if (primaryContact(c); as contact) {
                          <span class="text-xs text-muted-foreground">{{ contact }}</span>
                        }
                      }
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-0.5 text-xs font-medium">
                      <app-icon name="truck" [size]="12" class="text-muted-foreground" />
                      {{ c.company }}
                    </span>
                  </td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <app-icon name="map-pin" [size]="12" />
                      {{ c.state }}
                    </span>
                  </td>
                  <td class="p-4 align-middle text-sm text-muted-foreground">{{ c.branch || '—' }}</td>
                  <td class="p-4 text-right align-middle">
                    <div class="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        (click)="toggleFavourite(c.id)"
                        [attr.aria-label]="c.favourite ? 'Remove from favourites' : 'Add to favourites'"
                        [title]="c.favourite ? 'Remove from favourites' : 'Add to favourites'"
                        class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent"
                        [ngClass]="c.favourite ? 'text-[var(--warning)]' : ''"
                      >
                        <app-icon name="star" [filled]="c.favourite" [size]="13" />
                      </button>
                      <button type="button" (click)="openEdit(c)" title="Edit" aria-label="Edit contact" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                        <app-icon name="pencil" [size]="13" />
                      </button>
                      <button type="button" (click)="requestDelete(c)" title="Delete" aria-label="Delete contact" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                        <app-icon name="trash" [size]="13" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="p-8 text-center text-sm text-muted-foreground">No trade-in contacts match.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add / Edit modal -->
    @if (modal(); as kind) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">{{ kind === 'add' ? 'Add Contact' : 'Edit Contact' }}</span>
            <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Name
              <input type="text" [(ngModel)]="form.name" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Phone No
                <input type="tel" [(ngModel)]="form.phone" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Username
                <input type="text" [(ngModel)]="form.username" placeholder="&#64;ahmadfaiz" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <p class="text-[11px] text-muted-foreground">Provide a phone number and/or a WhatsApp username — at least one is required.</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Company
                <input type="text" [(ngModel)]="form.company" list="trade-in-companies" placeholder="e.g. ABC Used Cars" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                <datalist id="trade-in-companies">
                  @for (c of companies(); track c) { <option [value]="c"></option> }
                </datalist>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                State
                <select [(ngModel)]="form.state" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (s of states; track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </label>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Branch
              <input type="text" [(ngModel)]="form.branch" placeholder="e.g. Kota Bharu Branch" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Notes
              <textarea [(ngModel)]="form.notes" rows="2" class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"></textarea>
            </label>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitForm()" [disabled]="!canSubmit()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {{ kind === 'add' ? 'Add Contact' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete confirm -->
    @if (deleteTarget(); as target) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="cancelDelete()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              Delete contact?
            </span>
            <p class="text-sm text-muted-foreground">
              This permanently removes <strong class="text-foreground">{{ target.name }}</strong> ({{ target.company }}). This can't be undone.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="cancelDelete()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button
              type="button"
              (click)="confirmDelete()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TradeInsComponent {
  tabs: Tab[] = ['All', 'Favourites'];
  activeTab = signal<Tab>('All');

  states = MALAYSIAN_STATES;
  canSubmitTradeInContact = canSubmitTradeInContact;

  search = signal('');
  stateFilter = signal('All');
  selectedCompanies = signal<Set<string>>(new Set());
  // Defaults to Company, not Contact — every table in this app highlights a default-active sort
  // column, but never the identity column itself (Bankers defaults to "Bank" for the same reason).
  sortKey = signal<SortKey | null>('company');
  sortDir = signal<SortDir>('asc');

  modal = signal<ModalKind>(null);
  editingId = signal<string | null>(null);
  deleteTargetId = signal<string | null>(null);
  form: TradeInContactForm = { ...EMPTY_FORM };

  constructor(public tradeIns: TradeInService) {}

  deleteTarget = computed(() => this.tradeIns.contacts().find((c) => c.id === this.deleteTargetId()) ?? null);

  companies = computed(() => Array.from(new Set(this.tradeIns.contacts().map((c) => c.company))).sort((a, b) => a.localeCompare(b)));

  countFor(t: Tab): number {
    return t === 'All' ? this.tradeIns.contacts().length : this.tradeIns.favourites().length;
  }

  selectTab(t: Tab) {
    this.activeTab.set(t);
  }

  filteredSorted = computed(() => {
    let list = this.activeTab() === 'Favourites' ? this.tradeIns.favourites() : this.tradeIns.contacts();

    const search = this.search().trim().toLowerCase();
    if (search) {
      list = list.filter((c) => `${c.name} ${c.branch ?? ''}`.toLowerCase().includes(search));
    }
    if (this.stateFilter() !== 'All') list = list.filter((c) => c.state === this.stateFilter());
    const companies = this.selectedCompanies();
    if (companies.size > 0) list = list.filter((c) => companies.has(c.company));

    const key = this.sortKey();
    if (!key) return list;
    const dir = this.sortDir();
    return [...list].sort((a, b) => compareContacts(a, b, key, dir));
  });

  toggleCompanyFilter(company: string) {
    this.selectedCompanies.update((set) => {
      const next = new Set(set);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  }

  toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: SortKey): IconName {
    if (this.sortKey() !== key) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  hasActiveFilters(): boolean {
    return !!this.search() || this.stateFilter() !== 'All' || this.selectedCompanies().size > 0;
  }

  clearFilters() {
    this.search.set('');
    this.stateFilter.set('All');
    this.selectedCompanies.set(new Set());
  }

  toggleFavourite(id: string) {
    this.tradeIns.toggleFavourite(id);
  }

  chatHref(c: TradeInContactRecord): string | null {
    return whatsAppHref(c);
  }

  usernameText(c: TradeInContactRecord): string | null {
    return usernameDisplay(c.username);
  }

  /** Phone wins when both are on file — only one is ever shown under the name. */
  primaryContact(c: TradeInContactRecord): string | null {
    return c.phone?.trim() || this.usernameText(c);
  }

  openAdd() {
    this.form = { ...EMPTY_FORM };
    this.editingId.set(null);
    this.modal.set('add');
  }

  openEdit(c: TradeInContactRecord) {
    this.form = { name: c.name, phone: c.phone ?? '', username: c.username ?? '@', company: c.company, state: c.state, branch: c.branch ?? '', notes: c.notes ?? '' };
    this.editingId.set(c.id);
    this.modal.set('edit');
  }

  closeModal() {
    this.modal.set(null);
    this.editingId.set(null);
  }

  canSubmit(): boolean {
    return canSubmitTradeInContact(this.form);
  }

  async submitForm() {
    if (!this.canSubmit()) return;
    const input: NewTradeInContactInput = {
      name: this.form.name.trim(),
      phone: this.form.phone.trim() || undefined,
      username: normalizeUsername(this.form.username),
      company: this.form.company.trim(),
      state: this.form.state,
      branch: this.form.branch.trim() || undefined,
      notes: this.form.notes.trim() || undefined,
    };
    const id = this.editingId();
    if (this.modal() === 'edit' && id) {
      await this.tradeIns.editContact(id, input);
    } else {
      await this.tradeIns.addContact(input);
    }
    this.closeModal();
  }

  requestDelete(c: TradeInContactRecord) {
    this.deleteTargetId.set(c.id);
  }

  cancelDelete() {
    this.deleteTargetId.set(null);
  }

  async confirmDelete() {
    const id = this.deleteTargetId();
    if (!id) return;
    await this.tradeIns.deleteContact(id);
    this.deleteTargetId.set(null);
  }
}
