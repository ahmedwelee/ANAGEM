package ma.anagem.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.LocalizedJson;
import ma.anagem.cms.dto.EventDtos.EventCardDto;
import ma.anagem.cms.dto.EventDtos.Scope;
import ma.anagem.cms.dto.NewsDtos.NewsCardDto;
import ma.anagem.cms.dto.PublicationDtos.PublicationCardDto;
import ma.anagem.cms.dto.SiteDtos.*;
import ma.anagem.cms.entity.HomepageSection;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.repository.HomepageSectionRepository;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HomepageService {
    private static final int HOME_NEWS = 3, HOME_EVENTS = 4;
    private final HomepageSectionRepository repo;
    private final UserRepository users;
    private final NewsService news;
    private final EventService events;
    private final PublicationService publications;
    private final PartnerService partners;
    private final SettingsService settings;
    private final AuditService audit;

    // ---------- public ----------
    @Transactional(readOnly = true)
    public HomepageDto homepage(Lang lang) {
        Map<String, JsonNode> sections = new LinkedHashMap<>();
        for (HomepageSection s : repo.findAllByOrderBySortOrderAscIdAsc()) if (s.isEnabled() && !s.getSectionKey().startsWith(PageService.PREFIX)) sections.put(s.getSectionKey(), LocalizedJson.resolve(s.getContent(), lang));

        List<NewsCardDto> latest = new ArrayList<>(news.publicList(lang, null, null, null, null, 0, HOME_NEWS * 2).content());
        latest.sort(Comparator.comparing(NewsCardDto::featured).reversed()); // stable: featured first, then newest
        List<NewsCardDto> homeNews = latest.stream().limit(HOME_NEWS).toList();

        List<EventCardDto> homeEvents = new ArrayList<>(events.upcoming(lang, HOME_EVENTS));
        if (homeEvents.size() < HOME_EVENTS) homeEvents.addAll(events.publicList(lang, Scope.PAST, null, null, null, null, 0, HOME_EVENTS - homeEvents.size()).content());

        EventCardDto featured = pinned(sections.get("FEATURED_EVENT"), "eventId").flatMap(id -> events.byId(id, lang)).or(() -> events.featuredForHomepage(lang)).orElse(null);
        PublicationCardDto magazine = pinned(sections.get("MAGAZINE"), "publicationId").flatMap(id -> publications.byId(id, lang)).or(() -> publications.latestMagazineIssue(lang)).orElse(null);

        return new HomepageDto(lang.code(), sections, homeNews, homeEvents, featured, magazine, partners.publicList(lang), settings.publicSettings(lang));
    }

    private Optional<Long> pinned(JsonNode section, String field) {
        if (section == null || section.path("mode").asText("AUTO").equals("AUTO")) return Optional.empty();
        JsonNode id = section.get(field);
        return id != null && id.canConvertToLong() ? Optional.of(id.asLong()) : Optional.empty();
    }

    // ---------- admin ----------
    @Transactional(readOnly = true)
    public List<HomepageSectionDto> adminList() { return repo.findAllByOrderBySortOrderAscIdAsc().stream().map(this::toDto).toList(); }

    @Transactional
    public HomepageSectionDto update(String key, UpdateHomepageSectionRequest r) {
        HomepageSection s = repo.findBySectionKey(key).orElseThrow(() -> ApiException.notFound("Section"));
        if (!r.content().isObject()) throw ApiException.badRequest("INVALID_CONTENT", "Section content must be a JSON object");
        String raw = r.content().toString();
        if (raw.length() > 200_000) throw ApiException.badRequest("INVALID_CONTENT", "Section content is too large");
        if (raw.matches("(?s).*<\\s*[a-zA-Z/!].*")) throw ApiException.badRequest("HTML_NOT_ALLOWED", "HTML is not allowed in homepage text");
        s.setContent(r.content());
        if (r.enabled() != null) s.setEnabled(r.enabled());
        if (r.sortOrder() != null) s.setSortOrder(r.sortOrder());
        s.setUpdatedBy(users.getReferenceById(CurrentUser.require().id()));
        audit.log(AuditAction.UPDATE, "HOMEPAGE", key, "Edited homepage section " + key);
        repo.flush();
        return toDto(s);
    }

    private HomepageSectionDto toDto(HomepageSection s) {
        return new HomepageSectionDto(s.getId(), s.getSectionKey(), s.isEnabled(), s.getSortOrder(), s.getContent(), s.getVersion(), s.getUpdatedAt());
    }
}
