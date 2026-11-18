import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { encodeJpegWithBudget } from './image-compress';

/** Width of the stage the photo is displayed and dragged within, in CSS px (square crops). Wide crops
 *  use WIDE_STAGE_WIDTH, with the height following the aspect ratio. */
const STAGE_SIZE = 280;
const WIDE_STAGE_WIDTH = 320;
const MAX_ZOOM = 4;

/**
 * Full-screen modal that lets the user pan and zoom a just-picked photo before it's saved,
 * so the stored image is always a well-framed square crop rather than whatever the raw upload was.
 * Supports mouse drag, single-finger touch drag, and two-finger pinch-to-zoom via the Pointer Events API.
 */
@Component({
  selector: 'app-image-crop-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="cancel.emit()"></button>
      <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex items-center gap-3 border-b border-border p-4">
          <span class="text-sm font-semibold">{{ title }}</span>
          <button
            type="button"
            (click)="cancel.emit()"
            aria-label="Close"
            class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </div>

        <div class="flex flex-col items-center gap-4 p-4">
          <div
            class="relative touch-none select-none overflow-hidden rounded-2xl border border-border bg-muted/40"
            [style.width.px]="stageW"
            [style.height.px]="stageH"
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp($event)"
            (pointercancel)="onPointerUp($event)"
            (wheel)="onWheel($event)"
          >
            @if (img(); as image) {
              <img
                [src]="image.src"
                alt=""
                draggable="false"
                class="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                [style.width.px]="image.naturalWidth"
                [style.height.px]="image.naturalHeight"
                [style.transform]="'translate(-50%, -50%) translate(' + panX() + 'px, ' + panY() + 'px) scale(' + displayScale() + ')'"
              />
            }
          </div>

          <div class="flex w-full items-center gap-2">
            <app-icon name="zoom-out" [size]="18" class="shrink-0 text-muted-foreground" />
            <input
              type="range"
              min="1"
              max="{{ maxZoom }}"
              step="0.01"
              [ngModel]="zoom()"
              (ngModelChange)="setZoom($event)"
              class="h-1.5 w-full accent-primary"
            />
            <app-icon name="zoom-in" [size]="18" class="shrink-0 text-muted-foreground" />
          </div>
          <span class="text-xs text-muted-foreground">Drag to move &middot; pinch or use the slider to zoom</span>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border p-4">
          <button type="button" (click)="cancel.emit()" class="rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            Cancel
          </button>
          <button type="button" (click)="save()" class="rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Use Photo
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ImageCropModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) file!: File;
  /** Width ÷ height of the crop: 1 for the square profile photo, 3 for the wide cover photo. */
  @Input() aspect = 1;
  /** Exported width in px (height follows the aspect), before JPEG byte-budget encoding. */
  @Input() outputWidth = 480;
  @Input() maxBytes = 150 * 1024;
  @Input() title = 'Adjust Photo';
  @Output() crop = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  get stageW(): number {
    return this.aspect > 1 ? WIDE_STAGE_WIDTH : STAGE_SIZE;
  }
  get stageH(): number {
    return Math.round(this.stageW / this.aspect);
  }
  maxZoom = MAX_ZOOM;

  img = signal<HTMLImageElement | null>(null);
  zoom = signal(1);
  panX = signal(0);
  panY = signal(0);

  /** CSS scale applied to the (full natural-resolution) <img> so it covers the stage at zoom=1. */
  private baseScale = computed(() => {
    const image = this.img();
    if (!image) return 1;
    return Math.max(this.stageW / image.naturalWidth, this.stageH / image.naturalHeight);
  });
  displayScale = computed(() => this.baseScale() * this.zoom());
  private maxPanX = computed(() => {
    const image = this.img();
    if (!image) return 0;
    return Math.max(0, (image.naturalWidth * this.displayScale() - this.stageW) / 2);
  });
  private maxPanY = computed(() => {
    const image = this.img();
    if (!image) return 0;
    return Math.max(0, (image.naturalHeight * this.displayScale() - this.stageH) / 2);
  });

  // Active pointers, keyed by pointerId — one entry means single-finger pan, two means pinch-zoom.
  private pointers = new Map<number, { x: number; y: number }>();
  private panStart = { x: 0, y: 0 };
  private dragStart = { x: 0, y: 0 };
  private pinchStartDist = 0;
  private pinchStartZoom = 1;

  // Kept alive for the modal's lifetime (unlike image-compress.ts's loadImage, which revokes
  // right after decode) since the <img> in the template re-reads this src on every render.
  private objectUrl: string | null = null;

  ngOnInit() {
    this.objectUrl = URL.createObjectURL(this.file);
    const image = new Image();
    image.onload = () => this.img.set(image);
    image.src = this.objectUrl;
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private clampPan() {
    const maxX = this.maxPanX();
    const maxY = this.maxPanY();
    this.panX.set(Math.min(maxX, Math.max(-maxX, this.panX())));
    this.panY.set(Math.min(maxY, Math.max(-maxY, this.panY())));
  }

  setZoom(value: number) {
    this.zoom.set(Math.min(this.maxZoom, Math.max(1, value)));
    this.clampPan();
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    this.setZoom(this.zoom() + (event.deltaY < 0 ? 0.08 : -0.08));
  }

  onPointerDown(event: PointerEvent) {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.panStart = { x: this.panX(), y: this.panY() };
    } else if (this.pointers.size === 2) {
      this.pinchStartDist = this.currentPinchDistance();
      this.pinchStartZoom = this.zoom();
    }
  }

  onPointerMove(event: PointerEvent) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      const dist = this.currentPinchDistance();
      if (this.pinchStartDist > 0) {
        this.setZoom(this.pinchStartZoom * (dist / this.pinchStartDist));
      }
      return;
    }

    if (this.pointers.size === 1) {
      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;
      this.panX.set(this.panStart.x + dx);
      this.panY.set(this.panStart.y + dy);
      this.clampPan();
    }
  }

  onPointerUp(event: PointerEvent) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 1) {
      // Dropped from a pinch back to a single finger — restart the pan baseline from here so the
      // image doesn't jump to account for the finger that was driving the pinch.
      const remaining = [...this.pointers.values()][0];
      this.dragStart = { x: remaining.x, y: remaining.y };
      this.panStart = { x: this.panX(), y: this.panY() };
    }
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  save() {
    const image = this.img();
    if (!image) return;

    const scale = this.displayScale();
    const dispW = image.naturalWidth * scale;
    const dispH = image.naturalHeight * scale;
    const imgLeft = this.stageW / 2 + this.panX() - dispW / 2;
    const imgTop = this.stageH / 2 + this.panY() - dispH / 2;

    const sx = -imgLeft / scale;
    const sy = -imgTop / scale;
    const sW = this.stageW / scale;
    const sH = this.stageH / scale;

    const outW = this.outputWidth;
    const outH = Math.round(outW / this.aspect);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, sx, sy, sW, sH, 0, 0, outW, outH);

    this.crop.emit(encodeJpegWithBudget(canvas, this.maxBytes));
  }
}
