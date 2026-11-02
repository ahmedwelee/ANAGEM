package ma.anagem.cms.common;

import java.text.Normalizer;
import java.util.UUID;
import java.util.function.Predicate;

public final class Slugs {
    private Slugs() {}

    /** Latin slug from a title; falls back to a short random id for titles without Latin letters (e.g. Arabic only). */
    public static String slugify(String text) {
        String base = text == null ? "" : Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase()
                .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (base.length() > 120) base = base.substring(0, 120).replaceAll("-+$", "");
        return base.isEmpty() ? "item-" + UUID.randomUUID().toString().substring(0, 8) : base;
    }

    public static String unique(String candidate, Predicate<String> exists) {
        String slug = candidate;
        int i = 2;
        while (exists.test(slug)) slug = candidate + "-" + i++;
        return slug;
    }
}
