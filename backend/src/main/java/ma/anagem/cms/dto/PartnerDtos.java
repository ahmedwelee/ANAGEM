package ma.anagem.cms.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;
import ma.anagem.cms.dto.MediaDtos.MediaDto;
import ma.anagem.cms.dto.MediaDtos.MediaRef;

public final class PartnerDtos {
    private PartnerDtos() {}

    public record PartnerNameDto(@NotBlank @Size(max = 200) String name) {}

    public record PartnerRequest(@NotBlank @Size(max = 200) String name, @Size(max = 500) @Pattern(regexp = "^https?://\\S+$", message = "must be an http(s) URL") String websiteUrl,
                                 UUID logoId, Integer sortOrder, Boolean active, Map<String, @Valid PartnerNameDto> translations) {}

    public record PartnerAdminDto(Long id, String name, String websiteUrl, MediaDto logo, int sortOrder, boolean active, Map<String, PartnerNameDto> translations) {}

    public record PartnerPublicDto(Long id, String name, String websiteUrl, MediaRef logo) {}
}
