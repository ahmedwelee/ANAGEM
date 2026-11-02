package ma.anagem.cms.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LangTest {
    @Test
    void arabicIsTheSiteDefault() {
        assertThat(Lang.DEFAULT).isEqualTo(Lang.AR);
        assertThat(Lang.ofOrDefault(null)).isEqualTo(Lang.AR);
        assertThat(Lang.ofOrDefault("de")).isEqualTo(Lang.AR);
    }

    @Test
    void codesAreCaseAndWhitespaceInsensitive() {
        assertThat(Lang.of(" FR ")).contains(Lang.FR);
        assertThat(Lang.of("En")).contains(Lang.EN);
        assertThat(Lang.of("ar")).contains(Lang.AR);
        assertThat(Lang.of("")).isEmpty();
        assertThat(Lang.of(null)).isEmpty();
        assertThat(Lang.of("fr-FR")).isEmpty();
    }

    @Test
    void explicitParameterBeatsAcceptLanguage() {
        assertThat(Lang.resolve("en", "fr-FR,fr;q=0.9")).isEqualTo(Lang.EN);
    }

    @Test
    void acceptLanguageUsesTheFirstSupportedTag() {
        assertThat(Lang.resolve(null, "fr-FR,fr;q=0.9,en;q=0.8")).isEqualTo(Lang.FR);
        assertThat(Lang.resolve(null, "de-DE, ar-MA;q=0.8, en;q=0.5")).isEqualTo(Lang.AR);
        assertThat(Lang.resolve(null, "en-GB")).isEqualTo(Lang.EN);
    }

    @Test
    void nothingUsableFallsBackToArabic() {
        assertThat(Lang.resolve(null, null)).isEqualTo(Lang.AR);
        assertThat(Lang.resolve("xx", "de,es;q=0.8")).isEqualTo(Lang.AR);
        assertThat(Lang.resolve("", "")).isEqualTo(Lang.AR);
    }

    @Test
    void exposesSupportedCodes() {
        assertThat(Lang.codes()).containsExactly("fr", "ar", "en");
        assertThat(Lang.isSupported("ar")).isTrue();
        assertThat(Lang.isSupported("es")).isFalse();
    }
}
