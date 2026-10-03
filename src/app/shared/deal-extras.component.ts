import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';
import { CustomerService } from './customer.service';
import { SettingsService } from './settings.service';
import { DEFAULT_COST_PRESETS, DEFAULT_GIFT_PRESETS, type CostPreset } from '../data/settings-data';
import { formatRM } from '../data/calculator-data';
import {
  freeGiftsSummary,
  giftBudgetReport,
  giftsStillToDo,
  totalCostSpent,
  type CostItem,
  type CustomerRecord,
  type FreeGiftItem,
} from '../data/customer-data';

/**
 * A deal's free gifts and extra costs.
 *
 * Gifts are promises to the customer — nothing is spent until one is sorted out, so a gift starts
 * "promised" and one tap on Done marks it sorted at its usual price (tap the amount if it really
 * cost something else). Extra costs are money out the customer never hears about; quick-buttons
 * add them in one tap. Shown in the customer panel (collapsed to one line) and in each Earnings row.
 */
@Component({
  selector: 'app-deal-extras',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TranslatePipe],
  template: `
    @if (collapsible) {
      <button type="button" (click)="open = !open" [attr.aria-expanded]="open" class="flex w-full items-center gap-2 rounded-xl bg-muted/50 p-3 text-left">
        <app-icon name="gift" [size]="14" class="shrink-0 text-muted-foreground" />
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ "Gifts & costs" | t }}</span>
        <span class="min-w-0 flex-1 truncate text-right text-xs" [ngClass]="toDoCount() > 0 ? 'font-semibold text-[var(--warning)]' : 'text-muted-foreground'">
          {{ summary().text | t: summary().params }}
        </span>
        <app-icon name="chevron-down" [size]="14" class="shrink-0 text-muted-foreground transition-transform" [ngClass]="open ? 'rotate-180' : ''" />
      </button>
    }

    @if (!collapsible || open) {
      <div class="grid gap-3" [ngClass]="columns ? 'lg:grid-cols-2' : ''">
        <!-- Promised gifts -->
        <section class="flex flex-col gap-2.5 rounded-xl p-3" [ngClass]="surface">
          <div class="flex flex-wrap items-baseline justify-between gap-x-2">
            <span class="flex flex-col">
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ "Promised to customer" | t }}</span>
              <span class="text-[11px] text-muted-foreground">{{ "Nothing's spent until you mark it Done" | t }}</span>
            </span>
            @if (showBudget && report(); as b) {
              <span class="text-xs tabular text-muted-foreground">
                {{ "Budget" | t }} {{ fmt(b.budget) }} · {{ "Actual" | t }} {{ fmt(b.actual) }}
                @if (b.variance !== 0) {
                  · <span class="font-semibold" [ngClass]="b.variance > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">{{ (b.variance > 0 ? '{amount} over' : '{amount} under') | t: { amount: fmt(abs(b.variance)) } }}</span>
                }
              </span>
            }
          </div>

          @if (record.freeGifts?.length) {
            <ul class="flex flex-col gap-1">
              @for (g of record.freeGifts; track g.id) {
                <li class="flex min-h-9 items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                  @if (g.done) {
                    <button type="button" (click)="setDone(g, false)" [title]="'Not done after all' | t" class="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--success)] hover:bg-accent">
                      <app-icon name="check" [size]="14" />
                    </button>
                  } @else {
                    <span class="flex size-6 shrink-0 items-center justify-center text-muted-foreground"><app-icon name="gift" [size]="13" /></span>
                  }
                  <span class="min-w-0 flex-1 truncate" [ngClass]="g.done ? 'text-muted-foreground' : 'text-foreground'">{{ g.name }}</span>

                  @if (editingId() === g.id) {
                    <ng-container [ngTemplateOutlet]="amountEditor" [ngTemplateOutletContext]="{ $implicit: g }" />
                  } @else if (g.done) {
                    <button type="button" (click)="startEdit(g)" [title]="'Tap to change what it cost' | t" class="rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular hover:bg-accent" [ngClass]="g.cost === 0 ? 'text-[var(--success)]' : 'text-foreground'">
                      {{ g.cost === 0 ? ('Free' | t) : g.cost == null ? ('Add cost' | t) : fmt(g.cost) }}
                    </button>
                  } @else {
                    @if (g.estimate != null) {
                      <span class="text-[11px] tabular text-muted-foreground">~{{ fmt(g.estimate) }}</span>
                    }
                    <button type="button" (click)="setDone(g, true)" class="rounded-md bg-[var(--success)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--success)] transition-colors hover:bg-[var(--success)]/20">{{ "Done" | t }}</button>
                  }
                  <button type="button" (click)="removeGift(g.id)" [attr.aria-label]="'Remove' | t" class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]">
                    <app-icon name="x" [size]="12" />
                  </button>
                </li>
              }
            </ul>
          }

          <!-- One tap: promise a usual gift at its usual price -->
          @if (giftQuickButtons().length) {
            <div class="flex flex-wrap gap-1.5">
              @for (p of giftQuickButtons(); track p.label) {
                <button type="button" (click)="addGift(p.label, p.amount)" class="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
                  <app-icon name="plus" [size]="10" />
                  {{ p.label }} <span class="text-muted-foreground">~{{ fmt(p.amount) }}</span>
                </button>
              }
            </div>
          }
          <form class="flex gap-2" (submit)="$event.preventDefault(); addCustomGift()">
            <input type="text" name="giftName" [placeholder]="'Other gift…' | t" [(ngModel)]="giftName" class="h-9 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none" />
            <input type="number" name="giftEst" step="10" [placeholder]="'~RM' | t" [(ngModel)]="giftEstimate" class="h-9 w-20 rounded-lg border border-input bg-input px-2 text-sm tabular text-foreground outline-none" />
            <button type="submit" [disabled]="!giftName.trim()" class="rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50">{{ "Add" | t }}</button>
          </form>
        </section>

        <!-- Extra costs -->
        <section class="flex flex-col gap-2.5 rounded-xl p-3" [ngClass]="surface">
          <div class="flex items-baseline justify-between gap-2">
            <span class="flex flex-col">
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ "Extra costs" | t }}</span>
              <span class="text-[11px] text-muted-foreground">{{ "Money you paid that the customer doesn't see" | t }}</span>
            </span>
            @if (record.costItems?.length) {
              <span class="text-xs font-semibold tabular text-[var(--destructive)]">{{ fmt(hiddenTotal()) }}</span>
            }
          </div>
          @if (record.costItems?.length) {
            <ul class="flex flex-col gap-1">
              @for (item of record.costItems; track item.id) {
                <li class="flex min-h-9 items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate text-foreground">{{ item.label }}</span>
                  <span class="font-semibold tabular" [ngClass]="item.amount >= 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">{{ item.amount < 0 ? '−' : '' }}{{ fmt(abs(item.amount)) }}</span>
                  <button type="button" (click)="removeCost(item.id)" [attr.aria-label]="'Remove' | t" class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]">
                    <app-icon name="x" [size]="12" />
                  </button>
                </li>
              }
            </ul>
          }
          <!-- One tap adds it straight away -->
          @if (costQuickButtons().length) {
            <div class="flex flex-wrap gap-1.5">
              @for (p of costQuickButtons(); track p.label) {
                <button type="button" (click)="addCost(p.label, p.amount)" class="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
                  <app-icon name="plus" [size]="10" />
                  {{ p.label }} <span class="text-muted-foreground">{{ fmt(p.amount) }}</span>
                </button>
              }
            </div>
          }
          <form class="flex gap-2" (submit)="$event.preventDefault(); addCustomCost()">
            <input [id]="'cost-label-' + record.id" type="text" name="costLabel" [placeholder]="'Other cost…' | t" [(ngModel)]="costLabel" class="h-9 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none" />
            <input type="number" name="costAmount" step="10" placeholder="RM" [title]="'Use a minus sign for money back' | t" [(ngModel)]="costAmount" class="h-9 w-20 rounded-lg border border-input bg-input px-2 text-sm tabular text-foreground outline-none" />
            <button type="submit" [disabled]="!customCostValid()" class="rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50">{{ "Add" | t }}</button>
          </form>
        </section>
      </div>

      @if (spent() !== 0 || stillToDo() > 0) {
        <div class="mt-2 flex items-center justify-end gap-3 px-1 text-xs tabular">
          @if (spent() !== 0) {
            <span class="text-muted-foreground">{{ "Spent" | t }} <strong class="text-[var(--destructive)]">{{ fmt(spent()) }}</strong></span>
          }
          @if (stillToDo() > 0) {
            <span class="text-muted-foreground">{{ "Still to do" | t }} <strong class="text-[var(--warning)]">~{{ fmt(stillToDo()) }}</strong></span>
          }
        </div>
      }
    }

    <!-- What a done gift really cost — pre-filled, Enter to save, 0 if the dealer supplied it -->
    <ng-template #amountEditor let-g>
      <span class="relative w-24">
        <span class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">RM</span>
        <input
          [id]="'gift-cost-' + g.id"
          type="number"
          inputmode="decimal"
          step="10"
          [ngModel]="editAmount()"
          (ngModelChange)="editAmount.set($event)"
          (keydown.enter)="saveEdit(g)"
          (keydown.escape)="editingId.set(null)"
          (blur)="saveEdit(g)"
          class="h-7 w-full rounded-md border border-input bg-input pl-8 pr-1 text-xs tabular text-foreground outline-none focus:border-ring"
        />
      </span>
    </ng-template>
  `,
})
export class DealExtrasComponent {
  @Input({ required: true }) record!: CustomerRecord;
  /** Side by side on wide screens (Earnings' expanded row) instead of stacked (customer panel). */
  @Input() columns = false;
  /** Background of each card — muted in the customer panel, card-coloured on Earnings' muted row. */
  @Input() surface = 'bg-muted/50';
  /** Show the gift budget vs actual line — Earnings does; the customer panel keeps it simple. */
  @Input() showBudget = false;
  /** Start as a one-line summary that opens on tap (the customer panel), instead of always open. */
  @Input() collapsible = false;

  open = false;
  giftName = '';
  giftEstimate: number | null = null;
  costLabel = '';
  costAmount: number | null = null;

  editingId = signal<string | null>(null);
  editAmount = signal<number | null>(null);

  private giftPresets = computed(() => this.settings.settings().salesDefaults.giftPresets ?? DEFAULT_GIFT_PRESETS);
  private costPresets = computed(() => this.settings.settings().salesDefaults.costPresets ?? DEFAULT_COST_PRESETS);

  fmt = (v: number) => formatRM(v);
  abs = Math.abs;

  constructor(
    private customers: CustomerService,
    private settings: SettingsService,
  ) {}

  // ---------- Summary ----------

  report = () => giftBudgetReport(this.record);
  spent = () => totalCostSpent(this.record);
  stillToDo = () => giftsStillToDo(this.record);
  hiddenTotal = () => (this.record.costItems ?? []).reduce((sum, c) => sum + c.amount, 0);
  toDoCount = () => {
    const g = freeGiftsSummary(this.record);
    return g ? g.total - g.done : 0;
  };

  /** One line for the collapsed panel, e.g. "1 gift to do · RM 450 spent". */
  summary(): { text: string; params: Record<string, string | number> } {
    const toDo = this.toDoCount();
    const spent = this.spent();
    const params = { n: toDo, spent: this.fmt(spent) };
    if (!this.record.freeGifts?.length && !this.record.costItems?.length) return { text: 'None yet — tap to add', params };
    if (toDo > 0 && spent !== 0) return { text: '{n} gift(s) to do · {spent} spent', params };
    if (toDo > 0) return { text: '{n} gift(s) to do', params };
    return { text: '{spent} spent', params };
  }

  // ---------- Gifts ----------

  /** The gift quick-buttons not already promised on this deal. */
  giftQuickButtons(): CostPreset[] {
    const gifts = this.record.freeGifts ?? [];
    return this.giftPresets().filter((p) => p.label.trim() && !gifts.some((g) => sameName(g.name, p.label)));
  }

  async addGift(name: string, estimate?: number) {
    const gift: FreeGiftItem = { id: crypto.randomUUID(), name: name.trim(), done: false, estimate };
    await this.customers.updateFreeGifts(this.record.id, [...(this.record.freeGifts ?? []), gift]);
  }

  async addCustomGift() {
    if (!this.giftName.trim()) return;
    const est = this.giftEstimate;
    await this.addGift(this.giftName, est === null || (est as unknown) === '' || !Number.isFinite(Number(est)) ? undefined : Number(est));
    this.giftName = '';
    this.giftEstimate = null;
  }

  /** Done assumes it cost its usual price — the amount can be changed with one tap afterwards. */
  async setDone(gift: FreeGiftItem, done: boolean) {
    await this.saveGift(gift.id, done ? { done: true, cost: gift.cost ?? gift.estimate } : { done: false, cost: undefined });
    if (done && gift.cost == null && gift.estimate == null) this.startEdit({ ...gift, done: true });
  }

  startEdit(gift: FreeGiftItem) {
    this.editingId.set(gift.id);
    this.editAmount.set(gift.cost ?? gift.estimate ?? null);
    setTimeout(() => (document.getElementById('gift-cost-' + gift.id) as HTMLInputElement | null)?.select());
  }

  async saveEdit(gift: FreeGiftItem) {
    if (this.editingId() !== gift.id) return;
    this.editingId.set(null);
    const v = this.editAmount();
    const cost = v === null || (v as unknown) === '' || !Number.isFinite(Number(v)) ? undefined : Number(v);
    if (cost !== gift.cost) await this.saveGift(gift.id, { cost });
  }

  async removeGift(id: string) {
    await this.customers.updateFreeGifts(this.record.id, (this.record.freeGifts ?? []).filter((g) => g.id !== id));
  }

  private async saveGift(id: string, patch: Partial<FreeGiftItem>) {
    await this.customers.updateFreeGifts(this.record.id, (this.record.freeGifts ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  // ---------- Extra costs ----------

  /** Extra-cost quick-buttons — minus any that are really gifts, so nothing gets entered twice. */
  costQuickButtons(): CostPreset[] {
    return this.costPresets().filter((p) => p.label.trim() && !this.giftPresets().some((g) => sameName(g.label, p.label)));
  }

  async addCost(label: string, amount: number) {
    const item: CostItem = { id: crypto.randomUUID(), label: label.trim(), amount };
    await this.customers.updateCostItems(this.record.id, [...(this.record.costItems ?? []), item]);
  }

  customCostValid(): boolean {
    const v = this.costAmount;
    return !!this.costLabel.trim() && v !== null && (v as unknown) !== '' && Number.isFinite(Number(v)) && Number(v) !== 0;
  }

  async addCustomCost() {
    if (!this.customCostValid()) return;
    await this.addCost(this.costLabel, Number(this.costAmount));
    this.costLabel = '';
    this.costAmount = null;
  }

  async removeCost(id: string) {
    await this.customers.updateCostItems(this.record.id, (this.record.costItems ?? []).filter((c) => c.id !== id));
  }
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
