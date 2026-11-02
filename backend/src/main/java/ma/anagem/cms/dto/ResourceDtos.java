package ma.anagem.cms.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.dto.ContentDtos.CategoryRef;
import ma.anagem.cms.dto.ContentDtos.TranslationStatus;
import ma.anagem.cms.dto.MediaDtos.MediaDto;
import ma.anagem.cms.dto.MediaDtos.MediaRef;
import ma.anagem.cms.entity.ResourceKind;

public final class ResourceDtos {
    private ResourceDtos() {}

    public record ResourceTextDto(@Size(max = 300) String title, @Size(max = 100_000) String description) {}

    public record ResourceRequest(@NotNull ResourceKind kind, @Size(max = 500) @Pattern(regexp = "^https?://\\S+$", message = "must be an http(s) URL") String externalUrl,
                                  Long categoryId, UUID fileId, @NotEmpty Map<String, @Valid ResourceTextDto> translations) {}

    public record ResourceAdminDto(Long id, ResourceKind kind, String externalUrl, ContentStatus status, Instant publishedAt, Long categoryId, MediaDto file,
                                   Map<String, ResourceTextDto> translations, List<TranslationStatus> translationStatus, String authorName, long version, Instant createdAt, Instant updatedAt) {}

    public record ResourceListItemDto(Long id, ResourceKind kind, ContentStatus status, Instant publishedAt, String title, String titleLocale, String categoryName,
                                      List<TranslationStatus> translationStatus, Instant updatedAt) {}

    public record ResourceCardDto(Long id, ResourceKind kind, String title, String description, Instant publishedAt, CategoryRef category, MediaRef file,
                                  String downloadUrl, String externalUrl, String locale, boolean fallback) {}
}
