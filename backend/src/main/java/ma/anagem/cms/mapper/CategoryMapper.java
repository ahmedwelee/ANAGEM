package ma.anagem.cms.mapper;

import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.CategoryDtos.CategoryDto;
import ma.anagem.cms.dto.ContentDtos.CategoryRef;
import ma.anagem.cms.entity.Category;

public final class CategoryMapper {
    private CategoryMapper() {}

    public static CategoryRef ref(Category c, Lang lang) {
        if (c == null) return null;
        var p = Localized.pick(c.getTranslations(), lang, t -> t.getName() != null && !t.getName().isBlank());
        return new CategoryRef(c.getId(), c.getSlug(), p == null ? c.getSlug() : p.value().getName());
    }

    public static CategoryDto toDto(Category c, Lang lang) {
        var p = Localized.pick(c.getTranslations(), lang, t -> t.getName() != null && !t.getName().isBlank());
        return new CategoryDto(c.getId(), c.getType().name(), c.getSlug(), p == null ? c.getSlug() : p.value().getName(), p == null ? null : p.value().getDescription());
    }
}
