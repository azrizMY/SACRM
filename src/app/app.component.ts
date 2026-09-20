import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
export class AppComponent {}
