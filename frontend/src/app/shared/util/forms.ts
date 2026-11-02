import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DEFAULT_LANG, LANGS, Lang, Translations } from '../../core/api/models';

/** A translated block (title + other fields): when anything is typed, the title is required. */
export const translationGroupValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const values = Object.values((c as FormGroup).getRawValue() as Record<string, unknown>);
  const any = values.some((x) => typeof x === 'string' && x.trim() !== '');
  const title = String((c.get('title') ?? c.get('name'))?.value ?? '').trim();
  return any && !title ? { titleNeeded: true } : null;
};

/** At least one language must have a title. */
export const atLeastOneLanguage: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  LANGS.some((l) => String((c.get(l + '.title') ?? c.get(l + '.name'))?.value ?? '').trim() !== '') ? null : { atLeastOne: true };

export function translationGroup(fields: string[], validators: Record<string, ValidatorFn[]> = {}): FormGroup {
  const lang = (): FormGroup => new FormGroup(Object.fromEntries(fields.map((f) => [f, new FormControl('', { nonNullable: true, validators: validators[f] ?? [] })])), { validators: translationGroupValidator });
  return new FormGroup({ fr: lang(), ar: lang(), en: lang() }, { validators: atLeastOneLanguage });
}

/** Only languages where something was typed; empty strings dropped. */
export function readTranslations<T>(group: AbstractControl | null): Translations<T> {
  const out: Translations<T> = {};
  for (const l of LANGS) {
    const v = (group?.get(l)?.getRawValue() ?? {}) as Record<string, string>;
    if (Object.values(v).some((x) => typeof x === 'string' && x.trim() !== '')) out[l] = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x])) as T;
  }
  return out;
}

export function writeTranslations(group: AbstractControl | null, tr: Translations<object> | undefined): void {
  for (const l of LANGS) {
    const g = group?.get(l) as FormGroup | null | undefined;
    if (!g) continue;
    const src = (tr?.[l] ?? {}) as Record<string, unknown>;
    g.reset(Object.fromEntries(Object.keys(g.controls).map((k) => [k, typeof src[k] === 'string' ? (src[k] as string) : ''])), { emitEvent: false });
  }
}

export function filledLanguages(group: AbstractControl | null): Partial<Record<Lang, boolean>> {
  return Object.fromEntries(LANGS.map((l) => [l, Object.values((group?.get(l)?.getRawValue() ?? {}) as Record<string, unknown>).some((x) => typeof x === 'string' && x.trim() !== '')]));
}

/** First language tab holding an invalid group, so save can reveal the problem. */
export function firstInvalidLanguage(group: AbstractControl | null): Lang | null {
  return LANGS.find((l) => group?.get(l)?.invalid) ?? null;
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** http(s) address; surrounding spaces (a pasted link) are tolerated because every form trims before sending. */
export const URL_PATTERN = /^\s*https?:\/\/\S+\s*$/;

export function pickText(tr: Translations<object> | undefined, lang: Lang, field: string): string {
  for (const l of [lang, DEFAULT_LANG, 'fr', 'en'] as Lang[]) { const v = (tr?.[l] as Record<string, unknown> | undefined)?.[field]; if (typeof v === 'string' && v.trim()) return v; }
  return '';
}
