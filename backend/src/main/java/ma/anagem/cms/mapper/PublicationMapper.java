package ma.anagem.cms.mapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.ContentDtos.TranslationStatus;
import ma.anagem.cms.dto.PublicationDtos.*;
import ma.anagem.cms.entity.Publication;
import ma.anagem.cms.entity.TitledText;

public final class PublicationMapper {
    private PublicationMapper() {}

    private static boolean usable(TitledText t) { return t.getTitle() != null && !t.getTitle().isBlank(); }

    public static List<TranslationStatus> status(Map<String, TitledText> tr) {
        return TranslationStatus.forAll(l -> {
            TitledText t = tr.get(l.code());
            Map<String, String> req = new LinkedHashMap<>();
            req.put("title", t == null ? null : t.getTitle());
            req.put("description", t == null ? null : t.getDescription());
            return TranslationStatus.of(l.code(), req, t != null);
        });
    }

    public static Map<String, PublicationTextDto> texts(Map<String, TitledText> tr) {
        Map<String, PublicationTextDto> out = new LinkedHashMap<>();
        tr.forEach((k, t) -> out.put(k, new PublicationTextDto(t.getTitle(), t.getDescription())));
        return out;
    }

    public static PublicationAdminDto toAdmin(Publication p) {
        return new PublicationAdminDto(p.getId(), p.getKind(), p.getPublicationYear(), p.getIssueNumber(), p.getStatus(), p.getPublishedAt(), p.isFeatured(),
                p.getCategory() == null ? null : p.getCategory().getId(), p.getCoverImage() == null ? null : MediaMapper.toDto(p.getCoverImage()),
                p.getPdfFile() == null ? null : MediaMapper.toDto(p.getPdfFile()), texts(p.getTranslations()), status(p.getTranslations()),
                p.getAuthor() == null ? null : p.getAuthor().getFullName(), p.getVersion(), p.getCreatedAt(), p.getUpdatedAt());
    }

    public static PublicationListItemDto toListItem(Publication p, Lang lang) {
        var pick = Localized.pick(p.getTranslations(), lang, PublicationMapper::usable);
        var cat = CategoryMapper.ref(p.getCategory(), lang);
        return new PublicationListItemDto(p.getId(), p.getKind(), p.getPublicationYear(), p.getIssueNumber(), p.getStatus(), p.getPublishedAt(), p.isFeatured(),
                pick == null ? "(untitled)" : pick.value().getTitle(), pick == null ? null : pick.locale(), cat == null ? null : cat.name(), status(p.getTranslations()), p.getUpdatedAt());
    }

    public static PublicationCardDto toCard(Publication p, Lang lang) {
        var pick = Localized.pick(p.getTranslations(), lang, PublicationMapper::usable);
        if (pick == null) return null;
        var pdf = MediaMapper.ref(p.getPdfFile(), lang);
        return new PublicationCardDto(p.getId(), p.getKind(), p.getPublicationYear(), p.getIssueNumber(), pick.value().getTitle(), pick.value().getDescription(), p.getPublishedAt(),
                CategoryMapper.ref(p.getCategory(), lang), MediaMapper.ref(p.getCoverImage(), lang), pdf, pdf == null ? null : pdf.url() + "?download=true", p.isFeatured(), pick.locale(), pick.fallback());
    }
}
