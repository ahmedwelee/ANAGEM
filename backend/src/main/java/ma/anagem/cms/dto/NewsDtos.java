package ma.anagem.cms.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.dto.ContentDtos.CategoryRef;
import ma.anagem.cms.dto.ContentDtos.TranslationStatus;
import ma.anagem.cms.dto.MediaDtos.MediaDto;
import ma.anagem.cms.dto.MediaDtos.MediaRef;

public final class NewsDtos {
    private NewsDtos() {}

    public record NewsTextDto(@Size(max = 300) String title, @Size(max = 1000) String summary, @Size(max = 200_000) String content,
                              @Size(max = 300) String seoTitle, @Size(max = 500) String seoDescription) {}

    public record NewsRequest(@Size(max = 180) @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "lowercase letters, digits and hyphens only") String slug,
                              Long categoryId, UUID featuredImageId, Boolean featured, Set<@NotBlank @Size(max = 60) String> tags,
                              @NotEmpty Map<String, @Valid NewsTextDto> translations) {}

    public record NewsAdminDto(Long id, String slug, ContentStatus status, Instant publishedAt, boolean featured, Long categoryId, MediaDto featuredImage,
                               List<String> tags, Map<String, NewsTextDto> translations, List<TranslationStatus> translationStatus,
                               String authorName, long version, Instant createdAt, Instant updatedAt) {}

    public record NewsListItemDto(Long id, String slug, ContentStatus status, Instant publishedAt, boolean featured, Long categoryId, String categoryName,
                                  String title, String titleLocale, List<TranslationStatus> translationStatus, String authorName, Instant updatedAt) {}

    public record NewsCardDto(Long id, String slug, String title, String summary, Instant publishedAt, CategoryRef category, List<String> tags,
                              boolean featured, MediaRef image, String locale, boolean fallback) {}

    public record NewsDetailDto(Long id, String slug, String title, String summary, String content, String seoTitle, String seoDescription,
                                Instant publishedAt, CategoryRef category, List<String> tags, boolean featured, MediaRef image,
                                String locale, boolean fallback, List<String> availableLocales) {}
}
