package ma.anagem.cms.service;

import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.*;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.EventDtos.*;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.EventMapper;
import ma.anagem.cms.repository.*;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventService {
    private static final List<String> SORTABLE = List.of("updatedAt", "createdAt", "startsAt", "id");
    private static final ZoneId ZONE = ZoneId.of(EventMapper.TIMEZONE);
    private final EventRepository repo;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final MediaService media;
    private final HtmlSanitizer sanitizer;
    private final ContentWorkflow workflow;
    private final AuditService audit;

    // ---------- admin ----------
    @Transactional(readOnly = true)
    public PageResponse<EventListItemDto> adminList(ContentStatus status, EventType type, Scope scope, String q, int page, int size, String sort, Lang lang) {
        Instant now = Instant.now();
        Specification<Event> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            if (type != null) ps.add(cb.equal(root.get("eventType"), type));
            if (scope != null) ps.add(scopePredicate(root, cb, scope, now));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.titleMatches(root, cb, q));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, SpecSupport.page(page, size, sort, SORTABLE, Sort.by(Sort.Direction.DESC, "startsAt")));
        return PageResponse.of(pg, e -> EventMapper.toListItem(e, lang));
    }

    @Transactional(readOnly = true)
    public EventAdminDto adminGet(Long id) { return EventMapper.toAdmin(find(id)); }

    @Transactional
    public EventAdminDto create(EventRequest r) {
        Event e = new Event();
        e.setAuthor(users.getReferenceById(CurrentUser.require().id()));
        apply(e, r);
        e.setSlug(newSlug(r.slug(), e));
        repo.save(e);
        audit.log(AuditAction.CREATE, "EVENT", e.getId(), "Created event " + e.getSlug());
        return EventMapper.toAdmin(e);
    }

    @Transactional
    public EventAdminDto update(Long id, EventRequest r) {
        Event e = find(id);
        workflow.assertEditable(e);
        apply(e, r);
        if (r.slug() != null && !r.slug().equals(e.getSlug())) {
            if (repo.existsBySlug(r.slug())) throw ApiException.conflict("SLUG_TAKEN", "Another event already uses this slug");
            e.setSlug(r.slug());
        }
        audit.log(AuditAction.UPDATE, "EVENT", id, "Updated event " + e.getSlug());
        repo.flush();
        return EventMapper.toAdmin(e);
    }

    @Transactional
    public void delete(Long id) {
        Event e = find(id);
        workflow.assertEditable(e);
        repo.delete(e);
        audit.log(AuditAction.DELETE, "EVENT", id, "Deleted event " + e.getSlug());
    }

    @Transactional
    public EventAdminDto changeStatus(Long id, StatusChangeRequest r) {
        Event e = find(id);
        ContentStatus before = e.getStatus();
        workflow.changeStatus(e, r, e.getTranslations().values().stream().anyMatch(t -> t.getTitle() != null && !t.getTitle().isBlank()));
        audit.log(AuditAction.STATUS_CHANGE, "EVENT", id, e.getSlug() + ": " + before + " -> " + e.getStatus());
        return EventMapper.toAdmin(e);
    }

    // ---------- public ----------
    @Transactional(readOnly = true)
    public PageResponse<EventCardDto> publicList(Lang lang, Scope scope, EventType type, Long categoryId, String q, Boolean featured, int page, int size) {
        Instant now = Instant.now();
        Scope s = scope == null ? Scope.UPCOMING : scope;
        Specification<Event> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            ps.add(SpecSupport.isPublic(root, cb, now));
            ps.add(scopePredicate(root, cb, s, now));
            if (type != null) ps.add(cb.equal(root.get("eventType"), type));
            if (categoryId != null) ps.add(cb.equal(root.get("category").get("id"), categoryId));
            if (featured != null) ps.add(cb.equal(root.get("featured"), featured));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.textMatches(root, cb, q, "title", "location"));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Sort sort = Sort.by(s == Scope.UPCOMING ? Sort.Direction.ASC : Sort.Direction.DESC, "startsAt");
        var pg = repo.findAll(spec, SpecSupport.page(page, size, null, SORTABLE, sort));
        return new PageResponse<>(pg.getContent().stream().map(e -> EventMapper.toCard(e, lang)).filter(Objects::nonNull).toList(), pg.getNumber(), pg.getSize(), pg.getTotalElements(), pg.getTotalPages());
    }

    @Transactional(readOnly = true)
    public List<EventCardDto> upcoming(Lang lang, int limit) { return publicList(lang, Scope.UPCOMING, null, null, null, null, 0, Math.min(Math.max(limit, 1), 20)).content(); }

    @Transactional(readOnly = true)
    public EventCardDto detail(String idOrSlug, Lang lang) {
        Optional<Event> found = idOrSlug.chars().allMatch(Character::isDigit) ? repo.findById(Long.parseLong(idOrSlug)) : repo.findBySlug(idOrSlug);
        Event e = found.filter(ContentWorkflow::isPublic).orElseThrow(() -> ApiException.notFound("Event"));
        EventCardDto d = EventMapper.toCard(e, lang);
        if (d == null) throw ApiException.notFound("Event");
        return d;
    }

    /** Homepage banner: the next (or ongoing) featured event; if none, the most recent featured one. */
    @Transactional(readOnly = true)
    public Optional<EventCardDto> featuredForHomepage(Lang lang) {
        var next = publicList(lang, Scope.UPCOMING, null, null, null, true, 0, 1).content();
        if (!next.isEmpty()) return Optional.of(next.get(0));
        return publicList(lang, Scope.PAST, null, null, null, true, 0, 1).content().stream().findFirst();
    }

    @Transactional(readOnly = true)
    public Optional<EventCardDto> byId(Long id, Lang lang) {
        return repo.findById(id).filter(ContentWorkflow::isPublic).map(e -> EventMapper.toCard(e, lang));
    }

    // ---------- helpers ----------
    private Predicate scopePredicate(jakarta.persistence.criteria.Root<Event> root, jakarta.persistence.criteria.CriteriaBuilder cb, Scope scope, Instant now) {
        var end = cb.coalesce(root.<Instant>get("endsAt"), root.<Instant>get("startsAt"));
        return switch (scope) {
            case UPCOMING -> cb.greaterThanOrEqualTo(end, now);
            case PAST -> cb.lessThan(end, now);
            case ALL -> cb.conjunction();
        };
    }

    private Event find(Long id) { return repo.findById(id).orElseThrow(() -> ApiException.notFound("Event")); }

    private void apply(Event e, EventRequest r) {
        ContentWorkflow.requireSupported(r.translations().keySet());
        if (r.endsAt() != null && r.endsAt().isBefore(r.startsAt())) throw ApiException.badRequest("END_BEFORE_START", "The end must not be before the start");
        Map<String, EventText> built = new LinkedHashMap<>();
        r.translations().forEach((locale, d) -> {
            boolean empty = blank(d.title()) && blank(d.description()) && blank(d.location()) && blank(d.organizer());
            if (empty) return;
            if (blank(d.title())) throw ApiException.badRequest("TITLE_REQUIRED", "A title is required for the '" + locale + "' version");
            EventText t = new EventText();
            t.setTitle(d.title().trim());
            t.setDescription(sanitizer.clean(d.description()));
            t.setLocation(blank(d.location()) ? null : d.location().trim());
            t.setOrganizer(blank(d.organizer()) ? null : d.organizer().trim());
            built.put(locale, t);
        });
        if (built.isEmpty()) throw ApiException.badRequest("NO_TRANSLATION", "At least one language version with a title is required");
        e.getTranslations().clear();
        e.getTranslations().putAll(built);
        e.setEventType(r.type());
        boolean allDay = Boolean.TRUE.equals(r.allDay());
        e.setAllDay(allDay);
        if (allDay) { // whole days in Moroccan local time, so the event stays "ongoing" until midnight of its last day
            LocalDate first = r.startsAt().atZone(ZONE).toLocalDate(), last = (r.endsAt() == null ? r.startsAt() : r.endsAt()).atZone(ZONE).toLocalDate();
            e.setStartsAt(first.atStartOfDay(ZONE).toInstant());
            e.setEndsAt(last.plusDays(1).atStartOfDay(ZONE).toInstant().minusSeconds(1));
        } else {
            e.setStartsAt(r.startsAt());
            e.setEndsAt(r.endsAt());
        }
        e.setRegistrationUrl(blank(r.registrationUrl()) ? null : r.registrationUrl().trim());
        e.setFeatured(Boolean.TRUE.equals(r.featured()));
        e.setCategory(r.categoryId() == null ? null : categories.findById(r.categoryId()).filter(c -> c.getType() == CategoryType.EVENT)
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_CATEGORY", "Unknown event category")));
        e.setImage(media.require(r.imageId(), MediaKind.IMAGE, "imageId"));
        e.setProgramFile(media.require(r.programFileId(), MediaKind.PDF, "programFileId"));
    }

    private String newSlug(String requested, Event e) {
        if (requested != null && !requested.isBlank()) {
            if (repo.existsBySlug(requested)) throw ApiException.conflict("SLUG_TAKEN", "Another event already uses this slug");
            return requested;
        }
        String title = Arrays.stream(Lang.values()).map(l -> e.getTranslations().get(l.code())).filter(Objects::nonNull).map(EventText::getTitle)
                .filter(t -> !Slugs.slugify(t).startsWith("item-")).findFirst().orElse(null);
        return Slugs.unique(Slugs.slugify(title) + "-" + e.getStartsAt().atZone(ZONE).getYear(), repo::existsBySlug);
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
