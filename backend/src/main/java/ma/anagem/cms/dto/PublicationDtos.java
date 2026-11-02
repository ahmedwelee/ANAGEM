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
import ma.anagem.cms.entity.PublicationKind;

public final class PublicationDtos {
    private PublicationDtos() {}

    public record PublicationTextDto(@Size(max = 300) String title, @Size(max = 100_000) String description) {}

    public record PublicationRequest(@NotNull PublicationKind kind, @NotNull @Min(1900) @Max(2100) Integer year, @Size(max = 30) String issueNumber,
                                     Long categoryId, UUID coverImageId, UUID pdfFileId, Boolean featured,
                                     @NotEmpty Map<String, @Valid PublicationTextDto> translations) {}

    public record PublicationAdminDto(Long id, PublicationKind kind, int year, String issueNumber, ContentStatus status, Instant publishedAt, boolean featured,
                                      Long categoryId, MediaDto coverImage, MediaDto pdfFile, Map<String, PublicationTextDto> translations,
                                      List<TranslationStatus> translationStatus, String authorName, long version, Instant createdAt, Instant updatedAt) {}

    public record PublicationListItemDto(Long id, PublicationKind kind, int year, String issueNumber, ContentStatus status, Instant publishedAt, boolean featured,
                                         String title, String titleLocale, String categoryName, List<TranslationStatus> translationStatus, Instant updatedAt) {}

    public record PublicationCardDto(Long id, PublicationKind kind, int year, String issueNumber, String title, String description, Instant publishedAt,
                                     CategoryRef category, MediaRef coverImage, MediaRef pdf, String pdfDownloadUrl, boolean featured, String locale, boolean fallback) {}
}
