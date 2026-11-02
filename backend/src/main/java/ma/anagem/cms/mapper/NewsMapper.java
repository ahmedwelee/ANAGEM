package ma.anagem.cms.mapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.ContentDtos.TranslationStatus;
import ma.anagem.cms.dto.NewsDtos.*;
import ma.anagem.cms.entity.News;
import ma.anagem.cms.entity.NewsText;

public final class NewsMapper {
    private NewsMapper() {}

    private static boolean usable(NewsText t) { return t.getTitle() != null && !t.getTitle().isBlank(); }

    public static List<TranslationStatus> status(News n) {
        return TranslationStatus.forAll(l -> {
            NewsText t = n.getTranslations().get(l.code());
            Map<String, String> req = new LinkedHashMap<>();
            req.put("title", t == null ? null : t.getTitle());
            req.put("summary", t == null ? null : t.getSummary());
            req.put("content", t == null ? null : t.getContent());
            return TranslationStatus.of(l.code(), req, t != null);
        });
    }

    public static NewsAdminDto toAdmin(News n) {
        Map<String, NewsTextDto> tr = new LinkedHashMap<>();
        n.getTranslations().forEach((k, t) -> tr.put(k, new NewsTextDto(t.getTitle(), t.getSummary(), t.getContent(), t.getSeoTitle(), t.getSeoDescription())));
        return new NewsAdminDto(n.getId(), n.getSlug(), n.getStatus(), n.getPublishedAt(), n.isFeatured(), n.getCategory() == null ? null : n.getCategory().getId(),
                n.getFeaturedImage() == null ? null : MediaMapper.toDto(n.getFeaturedImage()), List.copyOf(n.getTags()), tr, status(n),
                n.getAuthor() == null ? null : n.getAuthor().getFullName(), n.getVersion(), n.getCreatedAt(), n.getUpdatedAt());
    }

    public static NewsListItemDto toListItem(News n, Lang lang) {
        var p = Localized.pick(n.getTranslations(), lang, NewsMapper::usable);
        var cat = CategoryMapper.ref(n.getCategory(), lang);
        return new NewsListItemDto(n.getId(), n.getSlug(), n.getStatus(), n.getPublishedAt(), n.isFeatured(), cat == null ? null : cat.id(), cat == null ? null : cat.name(),
                p == null ? "(untitled)" : p.value().getTitle(), p == null ? null : p.locale(), status(n),
                n.getAuthor() == null ? null : n.getAuthor().getFullName(), n.getUpdatedAt());
    }

    /** Public card; null when the item has no usable translation at all. */
    public static NewsCardDto toCard(News n, Lang lang) {
        var p = Localized.pick(n.getTranslations(), lang, NewsMapper::usable);
        if (p == null) return null;
        NewsText t = p.value();
        return new NewsCardDto(n.getId(), n.getSlug(), t.getTitle(), t.getSummary(), n.getPublishedAt(), CategoryMapper.ref(n.getCategory(), lang),
                List.copyOf(n.getTags()), n.isFeatured(), MediaMapper.ref(n.getFeaturedImage(), lang), p.locale(), p.fallback());
    }

    public static NewsDetailDto toDetail(News n, Lang lang) {
        var p = Localized.pick(n.getTranslations(), lang, NewsMapper::usable);
        if (p == null) return null;
        NewsText t = p.value();
        List<String> available = n.getTranslations().entrySet().stream().filter(e -> usable(e.getValue())).map(Map.Entry::getKey).sorted().toList();
        return new NewsDetailDto(n.getId(), n.getSlug(), t.getTitle(), t.getSummary(), t.getContent(), t.getSeoTitle(), t.getSeoDescription(), n.getPublishedAt(),
                CategoryMapper.ref(n.getCategory(), lang), List.copyOf(n.getTags()), n.isFeatured(), MediaMapper.ref(n.getFeaturedImage(), lang), p.locale(), p.fallback(), available);
    }
}
