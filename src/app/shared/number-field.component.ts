import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * A numeric input with an optional fixed prefix/suffix (e.g. "RM", "%"). Shows the value with
 * thousands separators while not focused and the raw number while typing, so "109689" reads as
 * "109,689" at a glance without fighting the cursor. Emits `null` when cleared.
 */
@Component({
  selector: 'app-number-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex h-10 items-center gap-1.5 rounded-lg border bg-input px-3 transition-opacity"
      [ngClass]="[invalid ? 'border-[var(--destructive)]' : 'border-input', disabled ? 'opacity-50' : '']"
    >
      @if (prefix) {
        <span class="shrink-0 text-xs font-semibold text-muted-foreground">{{ prefix }}</span>
      }
      <input
        #el
        type="text"
        [attr.inputmode]="decimals > 0 ? 'decimal' : 'numeric'"
        [attr.id]="inputId"
        [attr.aria-label]="ariaLabel"
        [attr.aria-invalid]="invalid || null"
        [placeholder]="placeholder"
        [value]="display()"
        [disabled]="disabled"
        (focus)="onFocus()"
        (blur)="onBlur(el)"
        (input)="onInput(el.value)"
        (keydown.enter)="el.blur()"
        class="h-full w-full min-w-0 bg-transparent text-sm tabular text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
      />
      @if (suffix) {
        <span class="shrink-0 text-xs font-semibold text-muted-foreground">{{ suffix }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class NumberFieldComponent {
  @Input() set value(v: number | null | undefined) {
    this.bound = v ?? null;
    this.current.set(this.bound);
  }
  /** Last value the parent bound — what the field falls back to on blur, so a typed value the
   *  parent corrected back to its previous figure (e.g. a loan capped to what was already shown)
   *  never keeps displaying the rejected number just because the binding itself didn't change. */
  private bound: number | null = null;
  @Input() prefix = '';
  @Input() suffix = '';
  @Input() placeholder = '';
  /** Maximum decimal places shown when not focused. */
  @Input() decimals = 2;
  /** Thousands separators when not focused — off for plain numbers like a model year. */
  @Input() grouping = true;
  @Input() invalid = false;
  @Input() disabled = false;
  @Input() inputId: string | null = null;
  /** Fires when the SA finishes with the field (blur, or Enter which blurs) — for fields whose
   *  typed value is a draft that only takes effect once they're done (e.g. a loan amount). */
  @Output() committed = new EventEmitter<void>();
  @Input() ariaLabel: string | null = null;
  @Output() valueChange = new EventEmitter<number | null>();

  focused = signal(false);
  private current = signal<number | null>(null);
  private draft = signal('');

  display(): string {
    if (this.focused()) return this.draft();
    const v = this.current();
    if (v == null) return '';
    return v.toLocaleString('en-US', { maximumFractionDigits: this.decimals, useGrouping: this.grouping });
  }

  onFocus() {
    const v = this.current();
    this.draft.set(v == null ? '' : String(v));
    this.focused.set(true);
  }

  onBlur(el: HTMLInputElement) {
    this.focused.set(false);
    this.committed.emit();
    // If the parent changes the binding in response, its setter runs after this and wins.
    this.current.set(this.bound);
    // Write the text directly too: Angular only re-renders [value] when display() changes, and it
    // may compute the same string it last rendered even though the user typed over it.
    el.value = this.display();
  }

  onInput(text: string) {
    this.draft.set(text);
    const cleaned = text.replace(/[,\s]/g, '');
    if (!cleaned) {
      this.current.set(null);
      this.valueChange.emit(null);
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    this.current.set(n);
    this.valueChange.emit(n);
  }
}
