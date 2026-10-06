import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppUpdateService } from './shared/app-update.service';
import { InstallService } from './shared/install.service';
import { ThemeService } from './shared/theme.service';
import { TourOverlayComponent } from './shared/tour-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TourOverlayComponent],
  template: `
    <router-outlet />
    <app-tour-overlay />
  `,
})
export class AppComponent {
  // Created at startup so it catches the browser's one-off beforeinstallprompt event.
  private install = inject(InstallService);
  // Moves the installed app onto a new deploy at the next safe moment (see AppUpdateService).
  private updates = inject(AppUpdateService);
  // Keeps light / dark / System in step with Settings and with the device (see ThemeService).
  private theme = inject(ThemeService);
}
