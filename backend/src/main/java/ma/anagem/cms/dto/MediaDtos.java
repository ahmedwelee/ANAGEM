package ma.anagem.cms.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class MediaDtos {
    private MediaDtos() {}

    public record MediaTextDto(@Size(max = 500) String altText, @Size(max = 1000) String description) {}

    public record MediaDto(UUID id, String originalName, String contentType, String kind, long sizeBytes, Integer width, Integer height,
                           String url, String thumbnailUrl, Map<String, MediaTextDto> translations, Instant createdAt, String uploadedBy) {}

    public record UpdateMediaRequest(@NotNull Map<String, @Valid MediaTextDto> translations) {}

    /** Compact reference embedded in public content (alt text already localized). */
    public record MediaRef(UUID id, String url, String thumbnailUrl, String altText, Integer width, Integer height, String contentType) {}
}
