import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { stripLeadingZerosFromNumberInputs } from './app/shared/strip-leading-zeros';
import { installStaleChunkReload } from './app/shared/stale-chunk-reload';

stripLeadingZerosFromNumberInputs();
installStaleChunkReload();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
