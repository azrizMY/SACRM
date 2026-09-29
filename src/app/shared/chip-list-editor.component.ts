import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';

/** An editable list of names shown as chips — add by typing, remove with ×. Used by Settings for
 *  the account's own dropdown choices (lead sources, banks, insurers). With `defaultItem` bound,
 *  tapping a chip also marks it as the default (star + "Default" tag). */
@Component({
  selector: 'app-chip-list-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-2">
        @for (item of items; track item; let i = $index) {
          <span
            class="flex items-center rounded-lg text-sm transition-colors"
            [ngClass]="isDefault(item) ? 'bg-primary/12 text-foreground ring-1 ring-inset ring-primary/50' : 'bg-muted text-foreground'"
          >
            @if (selectable) {
              <button
                type="button"
                (click)="defaultItemChange.emit(item)"
                [attr.aria-pressed]="isDefault(item)"
                [attr.aria-label]="'Make ' + item + ' the default'"
                class="flex items-center gap-1.5 py-1.5 pl-3"
              >
                @if (isDefault(item)) { <app-icon name="star" [size]="12" class="text-primary" /> }
                {{ item }}
                @if (isDefault(item)) { <span class="text-[10px] font-semibold uppercase tracking-wide text-primary">Default</span> }
              </button>
            } @else {
              <span class="py-1.5 pl-3">{{ item }}</span>
            }
            <button type="button" (click)="remove(i)" [attr.aria-label]="'Remove ' + item" class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-[var(--destructive)]">
              <app-icon name="x" [size]="12" />
            </button>
          </span>
        } @empty {
          <span class="text-xs text-muted-foreground">Nothing on the list — add one below.</span>
        }
      </div>
      <div class="flex max-w-md items-center gap-2">
        <input
          type="text"
          [(ngModel)]="draft"
          (keydown.enter)="add()"
          [placeholder]="placeholder"
          [attr.aria-label]="addLabel"
          class="h-9 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none"
        />
        <button type="button" (click)="add()" [disabled]="!draft.trim()" class="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50">
          <app-icon name="plus" [size]="12" />
          Add
        </button>
      </div>
      @if (error) { <p class="text-xs text-[var(--destructive)]">{{ error }}</p> }
    </div>
  `,
})
export class ChipListEditorComponent {
  @Input({ required: true }) items: string[] = [];
  @Output() itemsChange = new EventEmitter<string[]>();
  /** Bind to make chips selectable as the default (lead sources); leave unbound for a plain list. */
  @Input() defaultItem: string | undefined;
  @Input() selectable = false;
  @Output() defaultItemChange = new EventEmitter<string | undefined>();
  @Input() placeholder = '';
  @Input() addLabel = 'New item';

  draft = '';
  error = '';

  isDefault(item: string): boolean {
    return this.selectable && this.defaultItem === item;
  }

  add() {
    const name = this.draft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (this.items.some((s) => s.toLowerCase() === name.toLowerCase())) {
      this.error = `"${name}" is already on the list.`;
      return;
    }
    this.itemsChange.emit([...this.items, name]);
    this.draft = '';
    this.error = '';
  }

  remove(i: number) {
    const removed = this.items[i];
    const next = this.items.filter((_, idx) => idx !== i);
    this.itemsChange.emit(next);
    // The default can't point at an item that's no longer on the list.
    if (this.selectable && this.defaultItem === removed) this.defaultItemChange.emit(next[0]);
    this.error = '';
  }
}
