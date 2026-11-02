package ma.anagem.cms.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import ma.anagem.cms.entity.CategoryType;

public final class CategoryDtos {
    private CategoryDtos() {}

    public record CategoryTextDto(@NotBlank @Size(max = 150) String name, @Size(max = 500) String description) {}

    public record CategoryRequest(@NotNull CategoryType type,
                                  @Size(max = 120) @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "lowercase letters, digits and hyphens only") String slug,
                                  Integer sortOrder, Boolean active,
                                  @NotEmpty Map<String, @Valid CategoryTextDto> translations) {}

    public record CategoryAdminDto(Long id, CategoryType type, String slug, int sortOrder, boolean active, Map<String, CategoryTextDto> translations, long usageCount) {}

    public record CategoryDto(Long id, String type, String slug, String name, String description) {}
}
