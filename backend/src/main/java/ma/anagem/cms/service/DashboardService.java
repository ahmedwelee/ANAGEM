package ma.anagem.cms.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.common.Visibility;
import ma.anagem.cms.dto.OpsDtos.*;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.repository.*;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private static final Set<String> EDITOR_VISIBLE_ACTIONS = Set.of("CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "UPLOAD");
    private final EntityManager em;
    private final NewsRepository news;
    private final PublicationRepository publications;
    private final EventRepository events;
    private final ResourceRepository resources;
    private final MediaFileRepository mediaFiles;
    private final ContactMessageRepository contacts;
    private final UserRepository users;
    private final AuditLogRepository audit;

    @Transactional(readOnly = true)
    public DashboardStats statistics() {
        Instant now = Instant.now();
        long upcoming = ((Number) em.createQuery("select count(e) from Event e where e.status in :s and e.publishedAt <= :now and coalesce(e.endsAt, e.startsAt) >= :now")
                .setParameter("s", Visibility.PUBLIC_STATUSES).setParameter("now", now).getSingleResult()).longValue();
        long past = ((Number) em.createQuery("select count(e) from Event e where e.status in :s and e.publishedAt <= :now and coalesce(e.endsAt, e.startsAt) < :now")
                .setParameter("s", Visibility.PUBLIC_STATUSES).setParameter("now", now).getSingleResult()).longValue();
        StatusCounts ev = counts("Event");
        @SuppressWarnings("unchecked")
        List<Object[]> months = em.createNativeQuery("""
                select to_char(date_trunc('month', published_at), 'YYYY-MM') m, count(*) from news
                where status in ('PUBLISHED', 'SCHEDULED') and published_at <= now() and published_at >= date_trunc('month', now()) - interval '11 months'
                group by 1 order by 1""").getResultList();
        Long adminUsers = CurrentUser.can("USER_MANAGE") ? users.count() : null;
        return new DashboardStats(counts("News"), counts("Publication"), new EventStats(ev.total(), ev.byStatus(), upcoming, past), counts("Resource"),
                mediaFiles.count(), contacts.countByStatus(ContactStatus.NEW), adminUsers,
                months.stream().map(r -> new MonthCount((String) r[0], ((Number) r[1]).longValue())).toList(), translationGaps());
    }

    private StatusCounts counts(String entity) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery("select x.status, count(x) from " + entity + " x group by x.status").getResultList();
        Map<String, Long> by = new LinkedHashMap<>();
        for (var s : ma.anagem.cms.common.ContentStatus.values()) by.put(s.name(), 0L);
        long total = 0;
        for (Object[] r : rows) { by.put(r[0].toString(), ((Number) r[1]).longValue()); total += ((Number) r[1]).longValue(); }
        return new StatusCounts(total, by);
    }

    /** Live (public) items that lack at least one language version: what an editor should translate next. */
    private Map<String, TranslationGapReport> translationGaps() {
        Instant now = Instant.now();
        Map<String, TranslationGapReport> out = new LinkedHashMap<>();
        List<TranslationGap> n = new ArrayList<>();
        for (News x : news.findAll(live(now), PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "publishedAt")))) gap(n, x.getId(), x.getTranslations(), NewsText::getTitle);
        out.put("news", report(n));
        List<TranslationGap> p = new ArrayList<>();
        for (Publication x : publications.findAll(live(now), PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "publishedAt")))) gap(p, x.getId(), x.getTranslations(), TitledText::getTitle);
        out.put("publications", report(p));
        List<TranslationGap> e = new ArrayList<>();
        for (Event x : events.findAll(live(now), PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "startsAt")))) gap(e, x.getId(), x.getTranslations(), EventText::getTitle);
        out.put("events", report(e));
        return out;
    }

    private <T> Specification<T> live(Instant now) {
        return (root, cq, cb) -> {
            Predicate pub = cb.and(root.get("status").in(Visibility.PUBLIC_STATUSES), cb.isNotNull(root.get("publishedAt")), cb.lessThanOrEqualTo(root.get("publishedAt"), now));
            return pub;
        };
    }

    private <T> void gap(List<TranslationGap> list, Long id, Map<String, T> tr, java.util.function.Function<T, String> title) {
        List<String> missing = new ArrayList<>();
        for (Lang l : Lang.values()) { T t = tr.get(l.code()); if (t == null || title.apply(t) == null || title.apply(t).isBlank()) missing.add(l.code()); }
        if (missing.isEmpty()) return;
        String best = tr.values().stream().map(title).filter(s -> s != null && !s.isBlank()).findFirst().orElse("(untitled)");
        list.add(new TranslationGap(id, best, missing));
    }

    private TranslationGapReport report(List<TranslationGap> all) { return new TranslationGapReport(all.size(), all.stream().limit(10).toList()); }

    @Transactional(readOnly = true)
    public List<AuditLogDto> recentActivity(int limit) {
        boolean full = CurrentUser.can("AUDIT_VIEW");
        Specification<AuditLog> spec = (root, cq, cb) -> full ? cb.conjunction() : root.get("action").in(EDITOR_VISIBLE_ACTIONS);
        return audit.findAll(spec, PageRequest.of(0, Math.min(Math.max(limit, 1), 50), Sort.by(Sort.Direction.DESC, "occurredAt", "id"))).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogDto> auditLog(String actor, String action, String resourceType, Instant from, Instant to, int page, int size) {
        Specification<AuditLog> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (actor != null && !actor.isBlank()) ps.add(cb.like(cb.lower(root.get("actorEmail")), "%" + actor.trim().toLowerCase() + "%"));
            if (action != null && !action.isBlank()) ps.add(cb.equal(root.get("action"), action.trim().toUpperCase()));
            if (resourceType != null && !resourceType.isBlank()) ps.add(cb.equal(root.get("resourceType"), resourceType.trim().toUpperCase()));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
            if (to != null) ps.add(cb.lessThan(root.get("occurredAt"), to));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = audit.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200), Sort.by(Sort.Direction.DESC, "occurredAt", "id")));
        return PageResponse.of(pg, this::toDto);
    }

    private AuditLogDto toDto(AuditLog a) {
        return new AuditLogDto(a.getId(), a.getOccurredAt(), a.getActorId(), a.getActorEmail(), a.getAction(), a.getResourceType(), a.getResourceId(), a.getSummary(), a.getIpAddress());
    }
}
