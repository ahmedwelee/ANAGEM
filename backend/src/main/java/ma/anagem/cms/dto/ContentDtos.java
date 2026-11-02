package ma.anagem.cms.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Lang;

public final class ContentDtos {
    private ContentDtos() {}

    public record StatusChangeRequest(@NotNull ContentStatus status, Instant publishedAt) {}

    /** Per-language completeness shown in the dashboard. {@code present} = a translation row exists, {@code complete} = all required fields filled. */
    public record TranslationStatus(String locale, boolean present, boolean complete, List<String> missingFields) {
        public static TranslationStatus of(String locale, Map<String, String> requiredFields, boolean present) {
            List<String> missing = new ArrayList<>();
            requiredFields.forEach((name, value) -> { if (value == null || value.isBlank()) missing.add(name); });
            return new TranslationStatus(locale, present, present && missing.isEmpty(), present ? missing : new ArrayList<>(requiredFields.keySet()));
        }

        public static List<TranslationStatus> forAll(java.util.function.Function<Lang, TranslationStatus> f) {
            return java.util.Arrays.stream(Lang.values()).map(f).toList();
        }
    }

    /** Localized category reference used in public payloads. */
    public record CategoryRef(Long id, String slug, String name) {}
}
