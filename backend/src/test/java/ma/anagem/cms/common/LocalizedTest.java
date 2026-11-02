package ma.anagem.cms.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LocalizedTest {
    private static Map<String, String> of(String... kv) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }

    private static boolean filled(String s) { return s != null && !s.isBlank(); }

    @Test
    void requestedLanguageWinsWithoutFallbackFlag() {
        var p = Localized.pick(of("fr", "Bonjour", "ar", "مرحبا", "en", "Hello"), Lang.EN, LocalizedTest::filled);
        assertThat(p.value()).isEqualTo("Hello");
        assertThat(p.locale()).isEqualTo("en");
        assertThat(p.fallback()).isFalse();
    }

    @Test
    void fallbackOrderIsRequestedThenArabicThenFrenchThenEnglish() {
        var all = of("fr", "Bonjour", "ar", "مرحبا", "en", "Hello");
        assertThat(Localized.pick(all, Lang.EN, s -> !s.equals("Hello")).locale()).isEqualTo("ar");
        assertThat(Localized.pick(of("fr", "Bonjour", "en", "Hello"), Lang.AR, LocalizedTest::filled).locale()).isEqualTo("fr");
        var fromEnglish = Localized.pick(of("en", "Hello"), Lang.FR, LocalizedTest::filled);
        assertThat(fromEnglish.locale()).isEqualTo("en");
        assertThat(fromEnglish.fallback()).isTrue();
    }

    @Test
    void blankTranslationsAreSkipped() {
        var p = Localized.pick(of("fr", "  ", "ar", "", "en", "Hello"), Lang.FR, LocalizedTest::filled);
        assertThat(p.locale()).isEqualTo("en");
        assertThat(p.fallback()).isTrue();
    }

    @Test
    void anyUsableTranslationIsBetterThanNone() {
        var p = Localized.pick(of("es", "Hola"), Lang.AR, LocalizedTest::filled);
        assertThat(p.value()).isEqualTo("Hola");
        assertThat(p.fallback()).isTrue();
    }

    @Test
    void nothingUsableGivesNull() {
        assertThat(Localized.pick(null, Lang.AR, LocalizedTest::filled)).isNull();
        assertThat(Localized.pick(Map.of(), Lang.AR, LocalizedTest::filled)).isNull();
        assertThat(Localized.pick(of("fr", " "), Lang.FR, LocalizedTest::filled)).isNull();
    }
}
