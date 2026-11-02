package ma.anagem.cms.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import ma.anagem.cms.dto.EventDtos.EventCardDto;
import ma.anagem.cms.dto.NewsDtos.NewsCardDto;
import ma.anagem.cms.dto.PartnerDtos.PartnerPublicDto;
import ma.anagem.cms.dto.PublicationDtos.PublicationCardDto;

public final class SiteDtos {
    private SiteDtos() {}

    public record SettingDto(String key, JsonNode value, boolean isPublic, Instant updatedAt) {}

    public record UpdateSettingsRequest(@NotNull Map<String, JsonNode> settings) {}

    public record HomepageSectionDto(Long id, String key, boolean enabled, int sortOrder, JsonNode content, long version, Instant updatedAt) {}

    public record UpdateHomepageSectionRequest(Boolean enabled, Integer sortOrder, @NotNull JsonNode content) {}

    /** Everything the public homepage needs, localized, in one response. */
    public record HomepageDto(String lang, Map<String, JsonNode> sections, List<NewsCardDto> news, List<EventCardDto> events, EventCardDto featuredEvent,
                              PublicationCardDto magazine, List<PartnerPublicDto> partners, Map<String, JsonNode> settings) {}
}
