import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../core/api/models';

/** Localized text for an API error: dictionary entry `apiErrors.<CODE>` when it exists, otherwise the server's message. */
export function apiErrorMessage(t: TranslocoService, e: ApiError): string {
  const key = 'apiErrors.' + e.code;
  const text = t.translate(key);
  return text && text !== key ? text : e.message;
}
