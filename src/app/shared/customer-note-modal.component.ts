import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import type { CustomerRecord } from '../data/customer-data';

@Component({
  selector: 'app-customer-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></button>
      <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex items-center gap-3 border-b border-border p-4">
          <span class="text-sm font-semibold">Add Note &middot; {{ record.name }}</span>
          <button type="button" (click)="close.emit()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
        <div class="flex flex-col gap-2 p-4">
          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Note
            <textarea rows="3" [(ngModel)]="text" placeholder="Add a quick note about this customer…" class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"></textarea>
          </label>
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-border p-4">
          <button type="button" (click)="close.emit()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
          <button type="button" (click)="submit()" [disabled]="!text.trim()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save Note</button>
        </div>
      </div>
    </div>
  `,
})
export class CustomerNoteModalComponent {
  @Input({ required: true }) record!: CustomerRecord;
  @Output() save = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  text = '';

  submit() {
    if (!this.text.trim()) return;
    this.save.emit(this.text.trim());
  }
}
