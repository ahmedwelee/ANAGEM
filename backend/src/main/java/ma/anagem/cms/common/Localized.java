package ma.anagem.cms.common;

import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/** Picks the best available translation: requested language, then Arabic (site default), French, English, then anything usable. */
public final class Localized {
    private Localized() {}

    public record Pick<T>(T value, String locale, boolean fallback) {}

    public static <T> Pick<T> pick(Map<String, T> translations, Lang requested, Predicate<T> usable) {
        if (translations == null || translations.isEmpty()) return null;
        for (String code : List.of(requested.code(), Lang.DEFAULT.code(), "fr", "en")) {
            T t = translations.get(code);
            if (t != null && usable.test(t)) return new Pick<>(t, code, !code.equals(requested.code()));
        }
        return translations.entrySet().stream().filter(e -> usable.test(e.getValue())).findFirst()
                .map(e -> new Pick<>(e.getValue(), e.getKey(), true)).orElse(null);
    }
}
