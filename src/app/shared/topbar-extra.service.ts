import { Injectable, TemplateRef, signal } from '@angular/core';

/**
 * Lets a routed page project a small bit of content (e.g. a mode switcher) into the topbar, right
 * beside its title — the topbar and the routed page are siblings under AppShellComponent, so there's
 * no `ng-content` path between them; this is the shared signal both ends read/write instead. A page
 * that sets this must clear it on destroy, or it keeps showing on every other page after navigating
 * away.
 */
@Injectable({ providedIn: 'root' })
export class TopbarExtraService {
  content = signal<TemplateRef<unknown> | null>(null);
}
