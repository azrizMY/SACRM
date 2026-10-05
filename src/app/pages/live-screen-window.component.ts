import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { LiveScreenComponent } from '../shared/live-screen.component';
import { LivePosterComponent } from '../shared/live-poster.component';
import { LIVE_ALIVE_MS, LIVE_CHANNEL, type LiveChannelMessage, type LiveFrame } from './live.component';

/**
 * The pop-out Live Screen — the window you capture in TikTok LIVE Studio or OBS. It has no
 * controls of its own: it shows whatever the Live Mode page sends, scaled to fill the window,
 * and keeps telling that page it's open so the page can put its own preview aside.
 */
@Component({
  selector: 'app-live-screen-window',
  standalone: true,
  imports: [LiveScreenComponent, LivePosterComponent],
  host: { class: 'fixed inset-0 block bg-black' },
  template: `
    @if (frame(); as f) {
      @if (f.design === 'live') {
        <app-live-screen [data]="f.data" />
      } @else {
        <app-live-poster [data]="f.poster" [templateId]="f.design" />
      }
    } @else {
      <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white/70">
        <span class="text-sm font-semibold">Waiting for Live Mode…</span>
        <span class="text-xs text-white/50">Keep the Live Mode page open in the main window.</span>
      </div>
    }
  `,
})
export class LiveScreenWindowComponent implements OnInit, OnDestroy {
  frame = signal<LiveFrame | null>(null);
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LIVE_CHANNEL) : null;
  private heartbeat?: ReturnType<typeof setInterval>;

  ngOnInit() {
    document.title = 'Redline — Live Screen';
    if (!this.channel) return;
    this.channel.onmessage = (e: MessageEvent<LiveChannelMessage>) => {
      if (e.data?.type === 'screen') this.frame.set(e.data.frame);
      if (e.data?.type === 'close') window.close();
    };
    // Ask the Live Mode page for the current screen straight away, then keep saying we're open.
    this.send({ type: 'hello' });
    this.heartbeat = setInterval(() => this.send({ type: 'alive' }), LIVE_ALIVE_MS);
  }

  @HostListener('window:pagehide')
  onClose() {
    this.send({ type: 'bye' });
  }

  ngOnDestroy() {
    clearInterval(this.heartbeat);
    this.channel?.close();
  }

  private send(message: LiveChannelMessage) {
    this.channel?.postMessage(message);
  }
}
