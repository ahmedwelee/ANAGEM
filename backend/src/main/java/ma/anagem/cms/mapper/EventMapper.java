package ma.anagem.cms.mapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.ContentDtos.TranslationStatus;
import ma.anagem.cms.dto.EventDtos.*;
import ma.anagem.cms.entity.Event;
import ma.anagem.cms.entity.EventText;

public final class EventMapper {
    public static final String TIMEZONE = "Africa/Casablanca";

    private EventMapper() {}

    private static boolean usable(EventText t) { return t.getTitle() != null && !t.getTitle().isBlank(); }

    public static TimeStatus timeStatus(Event e, Instant now) {
        if (now.isBefore(e.getStartsAt())) return TimeStatus.UPCOMING;
        return now.isAfter(e.effectiveEnd()) ? TimeStatus.PAST : TimeStatus.ONGOING;
    }

    public static List<TranslationStatus> status(Event e) {
        return TranslationStatus.forAll(l -> {
            EventText t = e.getTranslations().get(l.code());
            Map<String, String> req = new LinkedHashMap<>();
            req.put("title", t == null ? null : t.getTitle());
            req.put("description", t == null ? null : t.getDescription());
            req.put("location", t == null ? null : t.getLocation());
            return TranslationStatus.of(l.code(), req, t != null);
        });
    }

    public static EventAdminDto toAdmin(Event e) {
        Map<String, EventTextDto> tr = new LinkedHashMap<>();
        e.getTranslations().forEach((k, t) -> tr.put(k, new EventTextDto(t.getTitle(), t.getDescription(), t.getLocation(), t.getOrganizer())));
        return new EventAdminDto(e.getId(), e.getSlug(), e.getEventType(), e.getStartsAt(), e.getEndsAt(), e.isAllDay(), e.getRegistrationUrl(), e.getStatus(), e.getPublishedAt(),
                e.isFeatured(), e.getCategory() == null ? null : e.getCategory().getId(), e.getImage() == null ? null : MediaMapper.toDto(e.getImage()),
                e.getProgramFile() == null ? null : MediaMapper.toDto(e.getProgramFile()), tr, status(e), timeStatus(e, Instant.now()),
                e.getAuthor() == null ? null : e.getAuthor().getFullName(), e.getVersion(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static EventListItemDto toListItem(Event e, Lang lang) {
        var p = Localized.pick(e.getTranslations(), lang, EventMapper::usable);
        return new EventListItemDto(e.getId(), e.getSlug(), e.getEventType(), e.getStartsAt(), e.getEndsAt(), e.isAllDay(), e.getStatus(), e.getPublishedAt(), e.isFeatured(),
                p == null ? "(untitled)" : p.value().getTitle(), p == null ? null : p.locale(), p == null ? null : p.value().getLocation(), timeStatus(e, Instant.now()), status(e), e.getUpdatedAt());
    }

    public static EventCardDto toCard(Event e, Lang lang) {
        var p = Localized.pick(e.getTranslations(), lang, EventMapper::usable);
        if (p == null) return null;
        EventText t = p.value();
        var program = MediaMapper.ref(e.getProgramFile(), lang);
        return new EventCardDto(e.getId(), e.getSlug(), e.getEventType(), t.getTitle(), t.getDescription(), t.getLocation(), t.getOrganizer(), e.getStartsAt(), e.getEndsAt(), e.isAllDay(),
                TIMEZONE, timeStatus(e, Instant.now()), e.getRegistrationUrl(), CategoryMapper.ref(e.getCategory(), lang), MediaMapper.ref(e.getImage(), lang), program,
                program == null ? null : program.url() + "?download=true", e.isFeatured(), p.locale(), p.fallback());
    }
}
