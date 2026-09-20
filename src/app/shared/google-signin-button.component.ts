import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';

/** Public identifier for the OAuth Client ID created in Google Cloud Console (APIs & Services →
 *  Credentials). Not a secret — Google Client IDs are meant to be embedded in client-side code —
 *  but it must be replaced with a real one before Google sign-in will work. */
export const GOOGLE_CLIENT_ID = '650860080480-k2n7vfn9kesbbrfrinknffbu3rusatlj.apps.googleusercontent.com';

declare const google: {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(parent: HTMLElement, options: { type: string; theme: string; size: string; width?: number; text?: string }): void;
    };
  };
};

/** Renders Google's own "Sign in with Google" button (via the Identity Services script loaded in
 *  index.html) and emits the signed ID token it returns — the caller POSTs that token to
 *  `/api/auth/google` (see AuthService.loginWithGoogle) rather than this component talking to the
 *  backend directly, so it stays reusable across the login and signup pages. */
@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  template: `<div #container class="flex w-full justify-center"></div>`,
})
export class GoogleSignInButtonComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;
  @Output() credential = new EventEmitter<string>();

  private retry?: ReturnType<typeof setInterval>;

  ngAfterViewInit(): void {
    if (GOOGLE_CLIENT_ID.startsWith('REPLACE_WITH_')) return;
    // index.html loads Google's script with async/defer, so on a slower connection it may not have
    // arrived by the time this component is built — wait for it instead of giving up (which left the
    // page with no Google button at all).
    if (typeof google !== 'undefined') {
      this.render();
      return;
    }
    let waited = 0;
    this.retry = setInterval(() => {
      waited += 150;
      if (typeof google !== 'undefined') {
        clearInterval(this.retry);
        this.render();
      } else if (waited >= 15000) {
        clearInterval(this.retry);
      }
    }, 150);
  }

  ngOnDestroy(): void {
    clearInterval(this.retry);
  }

  private render(): void {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => this.credential.emit(response.credential),
    });
    google.accounts.id.renderButton(this.container.nativeElement, { type: 'standard', theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
  }
}
