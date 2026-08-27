import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent, type IconName } from '../shared/icon.component';
import { BankerService } from '../shared/banker.service';
import { BANK_OPTIONS } from '../data/customer-data';
import { MALAYSIAN_STATES, canSubmitBanker, normalizeUsername, usernameDisplay, whatsAppHref, type BankerRecord, type NewBankerInput } from '../data/banker-data';

type Tab = 'All' | 'Favourites';
type ModalKind = 'add' | 'edit' | null;
type SortKey = 'name' | 'bank' | 'state';
type SortDir = 'asc' | 'desc';

type BankerForm = {
  name: string;
  phone: string;
  username: string;
  bank: string;
  state: string;
  branch: string;
  notes: string;
};

const EMPTY_FORM: BankerForm = { name: '', phone: '', username: '@', bank: BANK_OPTIONS[0], state: MALAYSIAN_STATES[0], branch: '', notes: '' };

function compareBankers(a: BankerRecord, b: BankerRecord, key: SortKey, dir: SortDir): number {
  const cmp = a[key].localeCompare(b[key]);
  return dir === 'asc' ? cmp : -cmp;
}

@Component({
  selector: 'app-bankers',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 pb-16">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-balance text-xl font-semibold tracking-tight">Bankers</h2>
          <p class="text-pretty text-sm text-muted-foreground">Your bank contacts, filterable by state and bank — star the ones you work with most.</p>
        </div>
        <button
          type="button"
          (click)="openAdd()"
          class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <app-icon name="plus" [size]="14" />
          Add Banker
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
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bank</span>
            <div class="flex flex-wrap gap-1.5">
              @for (b of banks; track b) {
                <button
                  type="button"
                  (click)="toggleBankFilter(b)"
                  class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                  [ngClass]="
                    selectedBanks().has(b)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  "
                >
                  {{ b }}
                </button>
              }
            </div>
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
                    Banker
                    <app-icon [name]="sortIcon('name')" [size]="14" class="opacity-70" />
                  </button>
                </th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-left">
                  <button type="button" (click)="toggleSort('bank')" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="sortKey() === 'bank' ? 'text-foreground' : 'text-muted-foreground'">
                    Bank
                    <app-icon [name]="sortIcon('bank')" [size]="14" class="opacity-70" />
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
              @for (b of filteredSorted(); track b.id) {
                <tr class="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                  <td class="p-4 align-middle">
                    <div class="flex flex-col">
                      <span class="font-medium">{{ b.name }}</span>
                      @if (chatHref(b); as href) {
                        <a [href]="href" target="_blank" rel="noopener" class="text-xs text-primary hover:underline">{{ primaryContact(b) }}</a>
                      } @else {
                        @if (primaryContact(b); as contact) {
                          <span class="text-xs text-muted-foreground">{{ contact }}</span>
                        }
                      }
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-0.5 text-xs font-medium">
                      <app-icon name="landmark" [size]="12" class="text-muted-foreground" />
                      {{ b.bank }}
                    </span>
                  </td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <app-icon name="map-pin" [size]="12" />
                      {{ b.state }}
                    </span>
                  </td>
                  <td class="p-4 align-middle text-sm text-muted-foreground">{{ b.branch || '—' }}</td>
                  <td class="p-4 text-right align-middle">
                    <div class="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        (click)="toggleFavourite(b.id)"
                        [attr.aria-label]="b.favourite ? 'Remove from favourites' : 'Add to favourites'"
                        [title]="b.favourite ? 'Remove from favourites' : 'Add to favourites'"
                        class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent"
                        [ngClass]="b.favourite ? 'text-[var(--warning)]' : ''"
                      >
                        <app-icon name="star" [filled]="b.favourite" [size]="13" />
                      </button>
                      <button type="button" (click)="openEdit(b)" title="Edit" aria-label="Edit banker" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                        <app-icon name="pencil" [size]="13" />
                      </button>
                      <button type="button" (click)="requestDelete(b)" title="Delete" aria-label="Delete banker" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                        <app-icon name="trash" [size]="13" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="p-8 text-center text-sm text-muted-foreground">No bankers match.</td></tr>
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
            <span class="text-sm font-semibold">{{ kind === 'add' ? 'Add Banker' : 'Edit Banker' }}</span>
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
                Bank
                <select [(ngModel)]="form.bank" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (b of banks; track b) { <option [value]="b">{{ b }}</option> }
                </select>
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
              {{ kind === 'add' ? 'Add Banker' : 'Save' }}
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
              Delete banker?
            </span>
            <p class="text-sm text-muted-foreground">
              This permanently removes <strong class="text-foreground">{{ target.name }}</strong> ({{ target.bank }}). This can't be undone.
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
export class BankersComponent {
  tabs: Tab[] = ['All', 'Favourites'];
  activeTab = signal<Tab>('All');

  banks = BANK_OPTIONS;
  states = MALAYSIAN_STATES;
  canSubmitBanker = canSubmitBanker;

  search = signal('');
  stateFilter = signal('All');
  selectedBanks = signal<Set<string>>(new Set());
  // Defaults to Bank, not Banker — every table in this app highlights a default-active sort
  // column, but never the identity column itself (Customer Manager defaults to "Last Updated",
  // My Cars to "Brand").
  sortKey = signal<SortKey | null>('bank');
  sortDir = signal<SortDir>('asc');

  modal = signal<ModalKind>(null);
  editingId = signal<string | null>(null);
  deleteTargetId = signal<string | null>(null);
  form: BankerForm = { ...EMPTY_FORM };

  constructor(public bankers: BankerService) {}

  deleteTarget = computed(() => this.bankers.bankers().find((b) => b.id === this.deleteTargetId()) ?? null);

  countFor(t: Tab): number {
    return t === 'All' ? this.bankers.bankers().length : this.bankers.favourites().length;
  }

  selectTab(t: Tab) {
    this.activeTab.set(t);
  }

  filteredSorted = computed(() => {
    let list = this.activeTab() === 'Favourites' ? this.bankers.favourites() : this.bankers.bankers();

    const search = this.search().trim().toLowerCase();
    if (search) {
      list = list.filter((b) => `${b.name} ${b.branch ?? ''}`.toLowerCase().includes(search));
    }
    if (this.stateFilter() !== 'All') list = list.filter((b) => b.state === this.stateFilter());
    const banks = this.selectedBanks();
    if (banks.size > 0) list = list.filter((b) => banks.has(b.bank));

    const key = this.sortKey();
    if (!key) return list;
    const dir = this.sortDir();
    return [...list].sort((a, b) => compareBankers(a, b, key, dir));
  });

  toggleBankFilter(bank: string) {
    this.selectedBanks.update((set) => {
      const next = new Set(set);
      if (next.has(bank)) next.delete(bank);
      else next.add(bank);
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
    return !!this.search() || this.stateFilter() !== 'All' || this.selectedBanks().size > 0;
  }

  clearFilters() {
    this.search.set('');
    this.stateFilter.set('All');
    this.selectedBanks.set(new Set());
  }

  toggleFavourite(id: string) {
    this.bankers.toggleFavourite(id);
  }

  chatHref(b: BankerRecord): string | null {
    return whatsAppHref(b);
  }

  usernameText(b: BankerRecord): string | null {
    return usernameDisplay(b.username);
  }

  /** Phone wins when both are on file — only one is ever shown under the name. */
  primaryContact(b: BankerRecord): string | null {
    return b.phone?.trim() || this.usernameText(b);
  }

  openAdd() {
    this.form = { ...EMPTY_FORM };
    this.editingId.set(null);
    this.modal.set('add');
  }

  openEdit(b: BankerRecord) {
    this.form = { name: b.name, phone: b.phone ?? '', username: b.username ?? '@', bank: b.bank, state: b.state, branch: b.branch ?? '', notes: b.notes ?? '' };
    this.editingId.set(b.id);
    this.modal.set('edit');
  }

  closeModal() {
    this.modal.set(null);
    this.editingId.set(null);
  }

  canSubmit(): boolean {
    return canSubmitBanker(this.form);
  }

  async submitForm() {
    if (!this.canSubmit()) return;
    const input: NewBankerInput = {
      name: this.form.name.trim(),
      phone: this.form.phone.trim() || undefined,
      username: normalizeUsername(this.form.username),
      bank: this.form.bank,
      state: this.form.state,
      branch: this.form.branch.trim() || undefined,
      notes: this.form.notes.trim() || undefined,
    };
    const id = this.editingId();
    if (this.modal() === 'edit' && id) {
      await this.bankers.editBanker(id, input);
    } else {
      await this.bankers.addBanker(input);
    }
    this.closeModal();
  }

  requestDelete(b: BankerRecord) {
    this.deleteTargetId.set(b.id);
  }

  cancelDelete() {
    this.deleteTargetId.set(null);
  }

  async confirmDelete() {
    const id = this.deleteTargetId();
    if (!id) return;
    await this.bankers.deleteBanker(id);
    this.deleteTargetId.set(null);
  }
}
