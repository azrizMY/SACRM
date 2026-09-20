import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { stripLeadingZerosFromNumberInputs } from './app/shared/strip-leading-zeros';

stripLeadingZerosFromNumberInputs();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
