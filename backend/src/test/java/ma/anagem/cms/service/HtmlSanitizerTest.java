package ma.anagem.cms.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HtmlSanitizerTest {
    private final HtmlSanitizer sanitizer = new HtmlSanitizer();

    private String clean(String html) { return sanitizer.clean(html); }

    @Test
    void blankInputGivesNull() {
        assertThat(clean(null)).isNull();
        assertThat(clean("")).isNull();
        assertThat(clean("   \n ")).isNull();
    }

    @Test
    void normalEditorMarkupSurvives() {
        String html = "<h2>Titre</h2><p>Un <strong>texte</strong> avec <em>emphase</em>.</p><ul><li>un</li><li>deux</li></ul><blockquote>Citation</blockquote>";
        assertThat(clean(html)).isEqualTo(html);
    }

    @Test
    void scriptsStylesAndFramesDisappearCompletely() {
        String out = clean("<p>Avant</p><script>alert('xss')</script><style>body{display:none}</style><iframe src=\"https://evil.example\"></iframe><form action=\"/x\"><input name=a></form><p>Après</p>");
        assertThat(out).isEqualTo("<p>Avant</p><p>Après</p>");
    }

    @Test
    void eventHandlersAndInlineStylesAreStripped() {
        String out = clean("<p onclick=\"steal()\" style=\"position:fixed\">Texte</p><img src=\"/api/public/media/1\" onerror=\"alert(1)\">");
        assertThat(out).doesNotContain("onclick").doesNotContain("onerror").doesNotContain("style");
        assertThat(out).contains("Texte");
    }

    @Test
    void dangerousLinkTargetsAreRemoved() {
        for (String bad : new String[]{"javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox(1)", "//evil.example/x", "ftp://example.org/file"}) {
            String out = clean("<a href=\"" + bad + "\">lien</a>");
            assertThat(out).as(bad).doesNotContain("href").contains("lien");
        }
    }

    @Test
    void safeLinksKeepTheirTargetAndGetNoopenerRelations() {
        String out = clean("<a href=\"https://example.org/page\" target=\"_blank\">site</a>");
        assertThat(out).contains("href=\"https://example.org/page\"").contains("target=\"_blank\"").contains("noopener").contains("noreferrer");
        assertThat(clean("<a href=\"mailto:contact@example.org\">écrire</a>")).contains("mailto:contact&#64;example.org"); // '@' is entity-encoded, browsers decode it
        assertThat(clean("<a href=\"tel:+212500000000\">appeler</a>")).contains("tel:&#43;212500000000");
        assertThat(clean("<a href=\"#section\">ancre</a>")).contains("href=\"#section\"");
    }

    @Test
    void imagesMayOnlyComeFromTheMediaLibraryOrHttp() {
        assertThat(clean("<img src=\"/api/public/media/abc\" alt=\"Carte\">")).contains("src=\"/api/public/media/abc\"").contains("alt=\"Carte\"");
        assertThat(clean("<img src=\"https://example.org/a.png\" alt=\"\">")).contains("https://example.org/a.png");
        assertThat(clean("<img src=\"javascript:alert(1)\">")).doesNotContain("javascript");
        assertThat(clean("<img src=\"file:///etc/passwd\">")).doesNotContain("file:");
        assertThat(clean("<img src=\"/api/admin/users\">")).doesNotContain("/api/admin");
        assertThat(clean("<img src=\"/api/public/media/a\" width=\"300\" height=\"abc\">")).contains("width=\"300\"").doesNotContain("height");
    }

    @Test
    void textDirectionAndLanguageAttributesAreKeptForArabicContent() {
        String out = clean("<p dir=\"rtl\" lang=\"ar\">الجغرافيا المغربية</p>");
        assertThat(out).contains("dir=\"rtl\"").contains("lang=\"ar\"").contains("الجغرافيا المغربية");
    }

    @Test
    void tablesKeepTheirSpans() {
        String out = clean("<table><thead><tr><th colspan=\"2\">Programme</th></tr></thead><tbody><tr><td rowspan=\"2\">9h</td><td>Accueil</td></tr></tbody></table>");
        assertThat(out).contains("colspan=\"2\"").contains("rowspan=\"2\"").contains("<td>Accueil</td>");
    }

    @Test
    void unknownTagsAreDroppedButTheirTextIsKept() {
        assertThat(clean("<h1>Grand titre</h1><marquee>défile</marquee><custom-tag>x</custom-tag>")).isEqualTo("Grand titredéfilex");
    }

    @Test
    void brokenMarkupIsRepairedInsteadOfPassedThrough() {
        String out = clean("<p>ouvert <strong>gras <em>italique</p><script");
        assertThat(out).doesNotContain("<script");
        assertThat(out).startsWith("<p>").contains("<strong>");
    }
}
