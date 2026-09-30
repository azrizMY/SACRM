import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';
import { translate, type Lang, type Params } from './i18n-core';

export { translate, type Lang } from './i18n-core';

/** The signed-in app's UI language (Settings → Language). The customer link provides its own
 *  instance of this service, set to the advisor's poster language instead — see PublicQuoteComponent. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private settings = inject(SettingsService);
  private override = signal<Lang | null>(null);

  lang = computed<Lang>(() => this.override() ?? this.settings.settings().salesDefaults.uiLanguage ?? 'en');

  /** Pins this instance to a language regardless of the account setting. */
  use(lang: Lang) {
    this.override.set(lang);
  }

  t(en: string, params?: Params): string {
    return translate(this.lang(), en, params);
  }
}

/** `{{ 'Save Changes' | t }}` / `{{ 'Hi {name}' | t: { name } }}`. Impure so it follows a language
 *  switch without the component having to re-render for another reason. */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(en: string | null | undefined, params?: Params): string {
    return en == null ? '' : this.i18n.t(en, params);
  }
}
