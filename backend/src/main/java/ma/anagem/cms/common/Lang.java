package ma.anagem.cms.common;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/** Supported content languages. The code is what is stored in the *_translations.locale columns. */
public enum Lang {
    FR("fr"), AR("ar"), EN("en");

    private final String code;

    Lang(String code) { this.code = code; }

    /** The site's default language: where "/" leads, what the API answers when nothing is asked, and the first fallback for missing translations. */
    public static final Lang DEFAULT = AR;

    public String code() { return code; }

    public static Optional<Lang> of(String code) {
        if (code == null) return Optional.empty();
        String c = code.trim().toLowerCase();
        return Arrays.stream(values()).filter(l -> l.code.equals(c)).findFirst();
    }

    public static Lang ofOrDefault(String code) { return of(code).orElse(DEFAULT); }

    /** Explicit ?lang= wins, then the first Accept-Language tag, then the site default (Arabic). */
    public static Lang resolve(String param, String acceptLanguage) {
        var explicit = of(param);
        if (explicit.isPresent()) return explicit.get();
        if (acceptLanguage != null) {
            for (String part : acceptLanguage.split(",")) {
                var l = of(part.split(";")[0].trim().split("-")[0]);
                if (l.isPresent()) return l.get();
            }
        }
        return DEFAULT;
    }

    public static List<String> codes() { return Arrays.stream(values()).map(Lang::code).toList(); }

    public static boolean isSupported(String code) { return of(code).isPresent(); }
}
