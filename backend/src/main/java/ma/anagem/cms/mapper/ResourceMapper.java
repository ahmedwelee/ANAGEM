package ma.anagem.cms.mapper;

import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.ResourceDtos.*;
import ma.anagem.cms.entity.Resource;
import ma.anagem.cms.entity.TitledText;

public final class ResourceMapper {
    private ResourceMapper() {}

    private static boolean usable(TitledText t) { return t.getTitle() != null && !t.getTitle().isBlank(); }

    public static ResourceAdminDto toAdmin(Resource r) {
        var tr = new java.util.LinkedHashMap<String, ResourceTextDto>();
        r.getTranslations().forEach((k, t) -> tr.put(k, new ResourceTextDto(t.getTitle(), t.getDescription())));
        return new ResourceAdminDto(r.getId(), r.getKind(), r.getExternalUrl(), r.getStatus(), r.getPublishedAt(), r.getCategory() == null ? null : r.getCategory().getId(),
                r.getFile() == null ? null : MediaMapper.toDto(r.getFile()), tr, PublicationMapper.status(r.getTranslations()),
                r.getAuthor() == null ? null : r.getAuthor().getFullName(), r.getVersion(), r.getCreatedAt(), r.getUpdatedAt());
    }

    public static ResourceListItemDto toListItem(Resource r, Lang lang) {
        var p = Localized.pick(r.getTranslations(), lang, ResourceMapper::usable);
        var cat = CategoryMapper.ref(r.getCategory(), lang);
        return new ResourceListItemDto(r.getId(), r.getKind(), r.getStatus(), r.getPublishedAt(), p == null ? "(untitled)" : p.value().getTitle(), p == null ? null : p.locale(),
                cat == null ? null : cat.name(), PublicationMapper.status(r.getTranslations()), r.getUpdatedAt());
    }

    public static ResourceCardDto toCard(Resource r, Lang lang) {
        var p = Localized.pick(r.getTranslations(), lang, ResourceMapper::usable);
        if (p == null) return null;
        var file = MediaMapper.ref(r.getFile(), lang);
        return new ResourceCardDto(r.getId(), r.getKind(), p.value().getTitle(), p.value().getDescription(), r.getPublishedAt(), CategoryMapper.ref(r.getCategory(), lang),
                file, file == null ? null : file.url() + "?download=true", r.getExternalUrl(), p.locale(), p.fallback());
    }
}
