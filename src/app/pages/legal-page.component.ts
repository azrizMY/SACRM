import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { I18nService } from '../shared/i18n';
import { LEGAL, LEGAL_UPDATED, type LegalDoc, type LegalLang } from '../data/legal-content';

/** /privacy and /terms — open to everyone, signed in or not. Starts in the app's language (or
 *  ?lang=ms), with a BM/EN switch since the PDPA notice must be offered in both. */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="flex min-h-dvh flex-col text-foreground">
      <header class="border-b border-border">
        <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a routerLink="/welcome" class="flex items-center gap-2.5">
            <span class="logo-chip flex size-9 items-center justify-center rounded-xl"><app-icon name="car" [size]="18" /></span>
            <span class="flex flex-col leading-tight">
              <span class="text-sm font-bold tracking-tight">Redline</span>
              <span class="text-[11px] text-muted-foreground">Car Quotation</span>
            </span>
          </a>
          <div class="flex rounded-lg border border-border p-0.5 text-xs font-semibold" role="group" aria-label="Language">
            @for (l of langs; track l.id) {
              <button
                type="button"
                (click)="lang.set(l.id)"
                [attr.aria-pressed]="lang() === l.id"
                class="rounded-md px-3 py-1.5 transition-colors"
                [class]="lang() === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
              >
                {{ l.label }}
              </button>
            }
          </div>
        </div>
      </header>

      <main class="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ text().title }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ text().updated }}: {{ updated() }}</p>
        <p class="mt-6 text-pretty leading-relaxed text-muted-foreground">{{ text().intro }}</p>

        @for (s of text().sections; track s.heading) {
          <section class="mt-8">
            <h2 class="text-lg font-bold">{{ s.heading }}</h2>
            @for (p of s.body; track $index) {
              <p class="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{{ p }}</p>
            }
            @if (s.list) {
              <ul class="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary sm:text-base">
                @for (item of s.list; track $index) {
                  <li>{{ item }}</li>
                }
              </ul>
            }
          </section>
        }
      </main>

      <footer class="border-t border-border">
        <div class="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>Redline Car Quotation</span>
          <span class="flex gap-4">
            <a routerLink="/privacy" [queryParams]="{ lang: lang() }" class="transition-colors hover:text-foreground">{{ lang() === 'ms' ? 'Dasar Privasi' : 'Privacy Policy' }}</a>
            <a routerLink="/terms" [queryParams]="{ lang: lang() }" class="transition-colors hover:text-foreground">{{ lang() === 'ms' ? 'Terma Penggunaan' : 'Terms of Use' }}</a>
          </span>
        </div>
      </footer>
    </div>
  `,
})
export class LegalPageComponent {
  private route = inject(ActivatedRoute);
  private doc = this.route.snapshot.data['doc'] as LegalDoc;

  langs: { id: LegalLang; label: string }[] = [
    { id: 'ms', label: 'BM' },
    { id: 'en', label: 'EN' },
  ];
  private langParam = this.route.snapshot.queryParamMap.get('lang');
  lang = signal<LegalLang>(this.langParam === 'ms' || this.langParam === 'en' ? this.langParam : inject(I18nService).lang());
  text = computed(() => LEGAL[this.doc][this.lang()]);
  updated = computed(() =>
    new Date(LEGAL_UPDATED).toLocaleDateString(this.lang() === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'long', year: 'numeric' }),
  );
}
