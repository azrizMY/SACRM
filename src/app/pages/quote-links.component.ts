import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { TranslatePipe, translate } from '../shared/i18n';
import { AuthService } from '../shared/auth.service';
import { SettingsService } from '../shared/settings.service';
import { buildQrMatrix } from '../shared/qr-code';
import { downloadBlob } from '../shared/pdf-writer';

type LinkId = 'all' | 'brand';
type QuoteLink = {
  id: LinkId;
  title: string;
  hint: string;
  url: string;
  qr: string;
  message: string;
  file: string;
};

/** Pixels per QR module in the downloaded PNG, and the white margin (in modules) scanners need. */
const QR_SCALE = 16;
const QR_QUIET = 4;

/**
 * Quote Links: the SA's public quote page in two forms — every brand, or locked to their Primary
 * Brand — each with Copy, Open, Share on WhatsApp and a QR code. The page never asks the customer
 * for their details; it only shows the SA's own.
 */
@Component({
  selector: 'app-quote-links',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-bold tracking-tight">
          {{ 'Quote Links' | t }}
        </h2>
        <p class="text-pretty text-sm text-muted-foreground">
          {{
            'Send a link and your customer builds their own quote — no login, and they never have to give you their details.'
              | t
          }}
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        @for (link of links(); track link.id) {
          <div
            class="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
          >
            <div class="flex items-start gap-3 px-5 pt-5">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <app-icon
                  [name]="link.id === 'all' ? 'share' : 'star'"
                  [size]="18"
                />
              </span>
              <div class="flex min-w-0 flex-col gap-0.5">
                <span class="text-sm font-semibold">{{ link.title }}</span>
                <span class="text-xs text-muted-foreground">{{
                  link.hint
                }}</span>
              </div>
            </div>
            <ng-container
              *ngTemplateOutlet="linkBody; context: { $implicit: link }"
            />
            @if (link.id === 'brand') {
              <p
                class="border-t border-border px-5 py-3 text-[11px] text-muted-foreground"
              >
                {{ 'Locked to your Primary Brand.' | t }}
                <a
                  routerLink="/settings"
                  class="font-medium text-primary hover:underline"
                  >{{ 'Change it in Settings' | t }}</a
                >
              </p>
            }
          </div>
        }
      </div>

      <!-- What the customer gets -->
      <div
        class="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
      >
        <h3 class="text-sm font-semibold">
          {{ 'What your customer sees' | t }}
        </h3>
        <ul class="mt-3 grid gap-3 sm:grid-cols-2">
          @for (item of customerSees; track item.text) {
            <li class="flex items-start gap-3 text-sm">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                ><app-icon [name]="item.icon" [size]="15"
              /></span>
              <span class="pt-1.5 text-muted-foreground">{{
                item.text | t
              }}</span>
            </li>
          }
        </ul>
        <p class="mt-4 text-[11px] text-muted-foreground">
          {{ 'Your name, photo and contact come from' | t }}
          <a
            routerLink="/profile"
            class="font-medium text-primary hover:underline"
            >{{ 'My Profile' | t }}</a
          >{{ ', and prices from' | t }}
          <a
            routerLink="/price-settings"
            class="font-medium text-primary hover:underline"
            >{{ 'Price Settings' | t }}</a
          >.
        </p>
      </div>
    </div>

    <ng-template #linkBody let-link>
      <div
        class="flex flex-col items-center gap-4 px-5 py-5 sm:flex-row sm:items-start"
      >
        <!-- Dark modules on white so any phone camera reads it, in light or dark mode -->
        <img
          [src]="link.qr"
          [attr.alt]="'QR code for' | t"
          class="size-32 shrink-0 rounded-lg bg-white p-2"
        />
        <div class="flex w-full min-w-0 flex-col gap-2.5">
          <code
            class="block truncate rounded-md bg-muted/40 px-3 py-2 text-xs text-foreground"
            >{{ link.url }}</code
          >
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              (click)="copy(link)"
              class="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            >
              <app-icon
                [name]="copied() === link.id ? 'check' : 'clipboard-check'"
                [size]="13"
              />
              {{ (copied() === link.id ? 'Copied!' : 'Copy link') | t }}
            </button>
            <a
              [href]="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            >
              <app-icon name="arrow-up-right" [size]="13" />
              {{ 'Open' | t }}
            </a>
            <a
              [href]="whatsappUrl(link)"
              (click)="markShared()"
              target="_blank"
              rel="noopener"
              class="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <app-icon name="message-circle" [size]="13" />
              {{ 'Share on WhatsApp' | t }}
            </a>
            <button
              type="button"
              (click)="downloadQr(link)"
              class="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            >
              <app-icon name="download" [size]="13" />
              {{ 'Download QR' | t }}
            </button>
          </div>
        </div>
      </div>
    </ng-template>
  `,
})
export class QuoteLinksComponent {
  private auth = inject(AuthService);
  private settings = inject(SettingsService);

  copied = signal<LinkId | null>(null);
  private copiedTimer?: ReturnType<typeof setTimeout>;

  private token = computed(() => this.auth.currentUser()?.publicToken ?? '');
  private primaryBrand = computed(
    () => this.settings.settings().dashboardTarget.brand,
  );
  private uiLang = computed(
    () => this.settings.settings().salesDefaults.uiLanguage ?? 'en',
  );
  /** Settings → Language → WhatsApp messages. */
  private posterLang = computed(
    () => this.settings.whatsappLang(),
  );

  // ---------- The links ----------

  links = computed<QuoteLink[]>(() => {
    const base = `${location.origin}/quote/${this.token()}`;
    const brand = this.primaryBrand();
    const ui = this.uiLang();
    const poster = this.posterLang();
    return [
      {
        id: 'all',
        title: translate(ui, 'All brands'),
        hint: translate(ui, 'Your customer can pick any car you sell.'),
        url: base,
        qr: qrDataUrl(base, 8),
        message: translate(
          poster,
          'Here is my quote page. Pick a car and see your monthly instalment: {url}',
          { url: base },
        ),
        file: 'quote-link',
      },
      {
        id: 'brand',
        title: translate(ui, '{brand} only', { brand }),
        hint: translate(
          ui,
          'The same page, locked to {brand} — no brand switcher.',
          { brand },
        ),
        url: `${base}/brand`,
        qr: qrDataUrl(`${base}/brand`, 8),
        message: translate(
          poster,
          'Here is my {brand} quote page. Pick a car and see your monthly instalment: {url}',
          { brand, url: `${base}/brand` },
        ),
        file: `quote-link-${brand}`,
      },
    ];
  });

  readonly customerSees: { icon: IconName; text: string }[] = [
    {
      icon: 'car',
      text: 'Picks the car, down payment and tenure, and sees the monthly instalment change live.',
    },
    {
      icon: 'file-text',
      text: 'Saves the quote as a poster in your colour, with your name and photo on it.',
    },
    {
      icon: 'message-circle',
      text: 'Messages you on WhatsApp in one tap when they are ready.',
    },
    {
      icon: 'lock',
      text: 'No sign-up and no forms: they never type in their name, phone or IC.',
    },
  ];

  // ---------- Actions ----------

  async copy(link: QuoteLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      this.markShared();
      this.copied.set(link.id);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(null), 2000);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  }

  /** A ready-to-send message, in the advisor's WhatsApp-message language. */
  whatsappUrl(link: QuoteLink): string {
    return `https://wa.me/?text=${encodeURIComponent(link.message)}`;
  }

  markShared() {
    this.settings.markQuoteShared();
  }

  /** A large, print-ready PNG of the link's QR code. */
  async downloadQr(link: QuoteLink) {
    const blob = await (await fetch(qrDataUrl(link.url, QR_SCALE))).blob();
    downloadBlob(
      new Uint8Array(await blob.arrayBuffer()),
      `${link.file.replace(/[^\w-]+/g, '-')}-QR.png`,
      'image/png',
    );
    this.markShared();
  }
}

/** Draws a QR code (with its white quiet zone) onto a canvas and returns it as a PNG data URL. */
function qrDataUrl(text: string, scale: number): string {
  const matrix = buildQrMatrix(text);
  const size = (matrix.length + QR_QUIET * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#121214';
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark)
        ctx.fillRect(
          (x + QR_QUIET) * scale,
          (y + QR_QUIET) * scale,
          scale,
          scale,
        );
    }),
  );
  return canvas.toDataURL('image/png');
}
