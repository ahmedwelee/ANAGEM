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
import ma.anagem.cms.entity.EventType;

public final class EventDtos {
    private EventDtos() {}

    public enum TimeStatus { UPCOMING, ONGOING, PAST }

    public enum Scope { UPCOMING, PAST, ALL }

    public record EventTextDto(@Size(max = 300) String title, @Size(max = 100_000) String description, @Size(max = 300) String location, @Size(max = 300) String organizer) {}

    public record EventRequest(@Size(max = 180) @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "lowercase letters, digits and hyphens only") String slug,
                               @NotNull EventType type, @NotNull Instant startsAt, Instant endsAt, Boolean allDay,
                               @Size(max = 500) @Pattern(regexp = "^https?://\\S+$", message = "must be an http(s) URL") String registrationUrl,
                               Long categoryId, UUID imageId, UUID programFileId, Boolean featured,
                               @NotEmpty Map<String, @Valid EventTextDto> translations) {}

    public record EventAdminDto(Long id, String slug, EventType type, Instant startsAt, Instant endsAt, boolean allDay, String registrationUrl, ContentStatus status,
                                Instant publishedAt, boolean featured, Long categoryId, MediaDto image, MediaDto programFile, Map<String, EventTextDto> translations,
                                List<TranslationStatus> translationStatus, TimeStatus timeStatus, String authorName, long version, Instant createdAt, Instant updatedAt) {}

    public record EventListItemDto(Long id, String slug, EventType type, Instant startsAt, Instant endsAt, boolean allDay, ContentStatus status, Instant publishedAt,
                                   boolean featured, String title, String titleLocale, String location, TimeStatus timeStatus, List<TranslationStatus> translationStatus, Instant updatedAt) {}

    public record EventCardDto(Long id, String slug, EventType type, String title, String description, String location, String organizer, Instant startsAt, Instant endsAt,
                               boolean allDay, String timezone, TimeStatus timeStatus, String registrationUrl, CategoryRef category, MediaRef image, MediaRef program,
                               String programDownloadUrl, boolean featured, String locale, boolean fallback) {}
}
