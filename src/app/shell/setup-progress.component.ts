import { Component, ElementRef, HostListener, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GuideService } from '../shared/guide.service';
import { IconComponent } from '../shared/icon.component';
import { TranslatePipe } from '../shared/i18n';

/** Ring circumference for r=15 (2πr). */
const RING = 94.25;

/**
 * "Get set up · 2 of 5 done" in the menu, above the account. Clicking it opens the first-steps list
 * with the next step highlighted. Disappears once every step is done or the list is hidden.
 */
@Component({
  selector: 'app-setup-progress',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TranslatePipe],
  template: `
    @if (guide.firstStepsVisible()) {
      <div class="relative px-3 pb-2">
        <button
          type="button"
          (click)="open = !open"
          [attr.aria-expanded]="open"
          [attr.aria-label]="collapsed ? ('Get set up' | t) + ' · ' + ('{done} of {total} done' | t: { done: guide.firstStepsDone(), total: guide.firstSteps().length }) : null"
          [attr.title]="collapsed ? ('Get set up' | t) : null"
          class="flex min-h-12 w-full items-center gap-3 rounded-lg border border-primary/60 text-left transition-colors hover:bg-sidebar-accent"
          [ngClass]="collapsed ? 'justify-center px-0 py-1.5' : 'px-2.5 py-2'"
        >
          <svg width="30" height="30" viewBox="0 0 36 36" class="shrink-0" aria-hidden="true">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--sidebar-border)" stroke-width="4" />
            <circle
              cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round"
              [attr.stroke-dasharray]="ringDash()" transform="rotate(-90 18 18)"
              class="transition-[stroke-dasharray] duration-500"
            />
            <text x="18" y="22.5" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">{{ guide.firstStepsDone() }}</text>
          </svg>
          @if (!collapsed) {
            <span class="flex min-w-0 flex-1 flex-col leading-tight">
              <span class="truncate text-sm font-semibold text-sidebar-foreground">{{ 'Get set up' | t }}</span>
              <span class="truncate text-xs text-sidebar-muted">{{ '{done} of {total} done' | t: { done: guide.firstStepsDone(), total: guide.firstSteps().length } }}</span>
            </span>
            <app-icon [name]="open ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-sidebar-muted" />
          }
        </button>

        @if (open) {
          <div
            role="dialog"
            [attr.aria-label]="'Get set up' | t"
            class="absolute z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
            [ngClass]="variant === 'mobile' ? 'bottom-full left-3 mb-2' : 'bottom-0 left-full ml-2'"
          >
            <div class="flex items-center justify-between px-1">
              <h3 class="text-sm font-bold">{{ 'Get set up' | t }}</h3>
              <span class="text-xs text-muted-foreground">{{ '{done} of {total} done' | t: { done: guide.firstStepsDone(), total: guide.firstSteps().length } }}</span>
            </div>
            <div class="mx-1 mb-3 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-[width] duration-500" [style.width.%]="(guide.firstStepsDone() / guide.firstSteps().length) * 100"></div>
            </div>
            <ul class="flex flex-col gap-1">
              @for (s of guide.firstSteps(); track s.id) {
                @let isNext = guide.nextStep()?.id === s.id;
                <li>
                  <a
                    [routerLink]="s.link"
                    (click)="open = false"
                    class="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                    [ngClass]="isNext ? 'border border-primary' : 'border border-transparent'"
                  >
                    <span
                      class="flex size-6 shrink-0 items-center justify-center rounded-full border-2"
                      [ngClass]="s.done ? 'border-[var(--success)] bg-[var(--success)] text-[var(--success-foreground)]' : isNext ? 'border-primary' : 'border-control'"
                    >
                      @if (s.done) {<app-icon name="check" [size]="14" [strokeWidth]="3" />}
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="text-sm" [ngClass]="s.done ? 'text-muted-foreground line-through' : 'font-semibold'">{{ s.label | t }}</span>
                      @if (isNext) {<span class="text-xs text-muted-foreground">{{ s.hint | t }}</span>}
                    </span>
                    @if (isNext) {
                      <span class="btn btn-primary btn-sm shrink-0">{{ 'Go' | t }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
            <button type="button" (click)="hide()" class="mt-2 px-2 py-1 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
              {{ "Don't show this list" | t }}
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class SetupProgressComponent {
  @Input() collapsed = false;
  @Input() variant: 'desktop' | 'mobile' = 'desktop';

  guide = inject(GuideService);
  private host = inject(ElementRef);
  open = false;

  ringDash() {
    const done = this.guide.firstStepsDone() / this.guide.firstSteps().length;
    return `${(done * RING).toFixed(1)} ${RING}`;
  }

  hide() {
    this.open = false;
    this.guide.hideFirstSteps();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (this.open && !this.host.nativeElement.contains(event.target)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.open = false;
  }
}
