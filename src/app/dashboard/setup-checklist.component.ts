import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { TranslatePipe } from '../shared/i18n';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';

type Step = { id: string; icon: IconName; title: string; hint: string; link: string; action: string; done: boolean };

/** "Get set up" card at the top of the Dashboard for new accounts. Steps tick themselves off from
 *  real data; it goes away by itself once every step is done (and stays gone), or when closed early. */
@Component({
  selector: 'app-setup-checklist',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslatePipe],
  template: `
    @if (visible()) {
      <section class="animate-rise glow-border relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
        <span class="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl"></span>
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h2 class="text-base font-bold">{{ 'Get set up' | t }}</h2>
            <p class="text-sm text-muted-foreground">
              {{ 'A few quick steps to get the most out of Redline.' | t }}
            </p>
          </div>
          <button
            type="button"
            (click)="hide()"
            [attr.aria-label]="'Hide checklist' | t"
            class="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <div class="mt-4 flex items-center gap-3">
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)] transition-[width] duration-700 ease-[var(--ease-out-expo)]" [style.width.%]="(doneCount() / steps().length) * 100"></div>
          </div>
          <span class="font-mono text-xs font-semibold tabular text-muted-foreground">{{ doneCount() }}/{{ steps().length }}</span>
        </div>

        <ol class="mt-4 grid gap-2 sm:grid-cols-2">
          @for (s of steps(); track s.id) {
            <li class="min-w-0">
              <a
                [routerLink]="s.link"
                class="group flex items-center gap-3 rounded-xl border p-3 transition-colors"
                [class]="s.done ? 'border-transparent bg-muted/40' : 'border-border hover:border-primary/40 hover:bg-accent'"
              >
                @if (s.done) {
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]">
                    <app-icon name="check" [size]="16" />
                  </span>
                } @else {
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <app-icon [name]="s.icon" [size]="16" />
                  </span>
                }
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="text-sm font-semibold" [class.text-muted-foreground]="s.done" [class.line-through]="s.done">{{ s.title | t }}</span>
                  <span class="text-xs leading-snug text-muted-foreground">{{ s.hint | t }}</span>
                </span>
                @if (!s.done) {
                  <span class="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                    <span class="hidden sm:inline">{{ s.action | t }}</span>
                    <app-icon name="chevron-right" [size]="14" class="transition-transform group-hover:translate-x-0.5" />
                  </span>
                }
              </a>
            </li>
          }
        </ol>
      </section>
    }
  `,
})
export class SetupChecklistComponent {
  private advisor = inject(AdvisorService);
  private customers = inject(CustomerService);
  private settings = inject(SettingsService);
  private catalog = inject(VehicleCatalogService);

  steps = computed<Step[]>(() => {
    const profile = this.advisor.profile();
    return [
      {
        id: 'profile',
        icon: 'user',
        title: 'Complete your profile',
        hint: 'Add your photo and showroom. Customers see them on your quotes.',
        link: '/profile',
        action: 'Open',
        done: !!profile.photoUrl && !!profile.showroom?.name,
      },
      {
        id: 'prices',
        icon: 'tag',
        title: 'Set your prices',
        hint: 'Adjust prices and rebates to match your dealership.',
        link: '/price-settings',
        action: 'Open',
        done: this.catalog.hasPriceEdits(),
      },
      {
        id: 'quote',
        icon: 'calculator',
        title: 'Send your first quote',
        hint: 'Share a poster, or copy your customer link from Profile.',
        link: '/calculator',
        action: 'Start',
        done: !!this.settings.settings().onboarding.quoteShared,
      },
      {
        id: 'customer',
        icon: 'users',
        title: 'Add your first customer',
        hint: 'Track them from lead to won in Customer Manager.',
        link: '/leads',
        action: 'Add',
        done: this.customers.records().length > 0,
      },
    ];
  });

  doneCount = computed(() => this.steps().filter((s) => s.done).length);
  allDone = computed(() => this.doneCount() === this.steps().length);
  visible = computed(() => !this.settings.settings().onboarding.hidden && !this.allDone());

  constructor() {
    // Remember completion, so the card doesn't flash up on later visits while data is still loading.
    effect(() => {
      if (this.allDone() && !this.settings.settings().onboarding.hidden) this.hide();
    });
  }

  hide() {
    this.settings.updateOnboarding({ hidden: true });
  }
}
