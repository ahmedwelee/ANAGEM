import { imageOf, isExternal, linkTo, mediaUrl, stripHtml } from './util';

describe('public helpers', () => {
  it('linkTo builds router commands for CMS paths and keeps external URLs as text', () => {
    expect(linkTo('fr', '/publications')).toEqual(['/', 'fr', 'publications']);
    expect(linkTo('ar', 'news/some-slug')).toEqual(['/', 'ar', 'news', 'some-slug']);
    expect(linkTo('en', null)).toEqual(['/', 'en']);
    expect(linkTo('en', 'https://example.org/x')).toBe('https://example.org/x');
    expect(isExternal(linkTo('en', 'https://example.org'))).toBe(true);
    expect(isExternal(linkTo('en', '/news'))).toBe(false);
  });

  it('mediaUrl points at the public media endpoint and falls back when there is no media', () => {
    expect(mediaUrl('abc-123', '/img/x.jpg')).toBe('/api/public/media/abc-123');
    expect(mediaUrl(null, '/img/x.jpg')).toBe('/img/x.jpg');
    expect(mediaUrl('', '/img/x.jpg')).toBe('/img/x.jpg');
  });

  it('imageOf prefers the thumbnail unless the full image is asked for', () => {
    const m = { id: '1', url: '/full', thumbnailUrl: '/thumb', altText: null, width: 1, height: 1, contentType: 'image/jpeg' };
    expect(imageOf(m)).toBe('/thumb');
    expect(imageOf(m, true)).toBe('/full');
    expect(imageOf({ ...m, thumbnailUrl: null })).toBe('/full');
    expect(imageOf(null)).toBeNull();
  });

  it('stripHtml gives clean, bounded text for excerpts and meta descriptions', () => {
    expect(stripHtml('<p>Bonjour&nbsp;<strong>le</strong> monde &amp; tous</p>')).toBe('Bonjour le monde & tous');
    expect(stripHtml('<p>' + 'mot '.repeat(100) + '</p>', 20).length).toBeLessThanOrEqual(20);
    expect(stripHtml('<p>' + 'mot '.repeat(100) + '</p>', 20).endsWith('…')).toBe(true);
    expect(stripHtml(null)).toBe('');
  });
});
