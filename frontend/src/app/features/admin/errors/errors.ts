import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../../shared/components/states';

@Component({
  selector: 'app-forbidden',
  imports: [EmptyStateComponent, RouterLink, TranslocoPipe],
  template: `<app-empty-state icon="lock" title="errors.forbiddenTitle" hint="errors.forbiddenHint"><a routerLink="/admin" class="btn btn-primary">{{ 'common.back' | transloco }}</a></app-empty-state>`,
})
export class ForbiddenComponent {}

@Component({
  selector: 'app-not-found',
  imports: [EmptyStateComponent, RouterLink, TranslocoPipe],
  template: `<app-empty-state icon="circle-alert" title="errors.notFoundTitle" hint="errors.notFoundHint"><a routerLink="/admin" class="btn btn-primary">{{ 'common.back' | transloco }}</a></app-empty-state>`,
})
export class NotFoundComponent {}
