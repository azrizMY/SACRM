import { Component, inject, signal } from '@angular/core';
import { IconComponent } from './icon.component';
import { InstallService } from './install.service';
import { TranslatePipe } from './i18n';

/** Dismissible "install Redline on your phone" card shown at the top of the app. */
@Component({
  selector: 'app-install-banner',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  template: `
    @if (install.showBanner()) {
      <div class="animate-rise mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center">
        <div class="flex flex-1 items-start gap-3">
          <span class="logo-chip flex size-10 shrink-0 items-center justify-center rounded-xl">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-semibold">{{ 'Install Redline on your phone' | t }}</span>
            @if (showIosSteps()) {
              <span class="text-xs leading-relaxed text-muted-foreground">
                {{ 'Tap the Share button' | t }} <app-icon name="share" [size]="12" class="inline align-[-1px]" />
                {{ 'in Safari, then choose “Add to Home Screen”.' | t }}
              </span>
            } @else {
              <span class="text-xs text-muted-foreground">{{ 'Opens full screen from your home screen, just like an app.' | t }}</span>
            }
          </div>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button type="button" (click)="install.dismissBanner()" class="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            {{ 'Not now' | t }}
          </button>
          @if (!showIosSteps()) {
            <button type="button" (click)="onInstall()" class="btn-glow rounded-lg px-3.5 py-2 text-xs font-semibold">{{ 'Install' | t }}</button>
          }
        </div>
      </div>
    }
  `,
})
export class InstallBannerComponent {
  install = inject(InstallService);
  showIosSteps = signal(this.install.isIos && !this.install.canPrompt());

  async onInstall() {
    if (!this.install.canPrompt()) {
      this.showIosSteps.set(true);
      return;
    }
    await this.install.install();
  }
}
