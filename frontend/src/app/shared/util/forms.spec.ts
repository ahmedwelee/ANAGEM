import { FormControl, FormGroup, Validators } from '@angular/forms';
import { SLUG_PATTERN, URL_PATTERN, filledLanguages, firstInvalidLanguage, pickText, readTranslations, translationGroup, writeTranslations } from './forms';

describe('translation form groups', () => {
  const make = () => translationGroup(['title', 'summary']);

  it('requires at least one language with a title', () => {
    const g = make();
    expect(g.errors).toEqual({ atLeastOne: true });
    g.get('fr.title')!.setValue('Bonjour');
    expect(g.errors).toBeNull();
  });

  it('requires a title in a language as soon as another field of that language is filled', () => {
    const g = make();
    g.get('fr.title')!.setValue('Titre');
    g.get('ar.summary')!.setValue('ملخص بدون عنوان');
    expect(g.get('ar')!.errors).toEqual({ titleNeeded: true });
    expect(firstInvalidLanguage(g)).toBe('ar');
    g.get('ar.title')!.setValue('عنوان');
    expect(firstInvalidLanguage(g)).toBeNull();
  });

  it('treats whitespace as empty', () => {
    const g = make();
    g.get('en.summary')!.setValue('   ');
    expect(g.get('en')!.errors).toBeNull();
    expect(filledLanguages(g)).toEqual({ fr: false, ar: false, en: false });
  });

  it('reports which languages are filled', () => {
    const g = make();
    g.get('fr.title')!.setValue('A');
    g.get('en.summary')!.setValue('B');
    expect(filledLanguages(g)).toEqual({ fr: true, ar: false, en: true });
  });

  it('reads only the filled languages, trimmed', () => {
    const g = make();
    g.get('fr.title')!.setValue('  Titre  ');
    g.get('fr.summary')!.setValue('Résumé');
    expect(readTranslations<{ title: string; summary: string }>(g)).toEqual({ fr: { title: 'Titre', summary: 'Résumé' } });
  });

  it('writes translations back and clears languages that are missing', () => {
    const g = make();
    g.get('ar.title')!.setValue('قديم');
    writeTranslations(g, { fr: { title: 'Nouveau' } });
    expect(g.get('fr.title')!.value).toBe('Nouveau');
    expect(g.get('ar.title')!.value).toBe('');
  });

  it('applies per-field validators', () => {
    const g = translationGroup(['title'], { title: [Validators.maxLength(3)] });
    g.get('fr.title')!.setValue('too long');
    expect(g.get('fr.title')!.hasError('maxlength')).toBe(true);
  });
});

describe('pickText', () => {
  it('prefers the requested language, then fr, ar, en', () => {
    const tr = { ar: { title: 'ع' }, en: { title: 'E' } };
    expect(pickText(tr, 'en', 'title')).toBe('E');
    expect(pickText(tr, 'fr', 'title')).toBe('ع');
    expect(pickText({ en: { title: ' ' } }, 'fr', 'title')).toBe('');
    expect(pickText(undefined, 'fr', 'title')).toBe('');
  });
});

describe('patterns', () => {
  it('accepts clean slugs only', () => {
    expect(['a', 'a-b-1', 'rencontre-2026'].every((s) => SLUG_PATTERN.test(s))).toBe(true);
    expect(['A', 'a--b', '-a', 'a-', 'a b', 'é'].some((s) => SLUG_PATTERN.test(s))).toBe(false);
  });
  it('accepts http(s) URLs only', () => {
    expect(URL_PATTERN.test('https://anagem.ma/x?y=1')).toBe(true);
    expect(URL_PATTERN.test('javascript:alert(1)')).toBe(false);
    expect(URL_PATTERN.test('ftp://x')).toBe(false);
  });
});

it('FormGroup helpers tolerate null groups', () => {
  expect(filledLanguages(null)).toEqual({ fr: false, ar: false, en: false });
  expect(firstInvalidLanguage(null)).toBeNull();
  expect(readTranslations(new FormGroup({ fr: new FormGroup({ title: new FormControl('') }) }))).toEqual({});
});
