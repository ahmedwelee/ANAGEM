package ma.anagem.cms.service;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.MapJoin;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Visibility;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

final class SpecSupport {
    private SpecSupport() {}

    /** Title search across every language version (case-insensitive substring). */
    static Predicate titleMatches(Root<?> root, CriteriaBuilder cb, String q) { return textMatches(root, cb, q, "title"); }

    static Predicate textMatches(Root<?> root, CriteriaBuilder cb, String q, String... fields) {
        MapJoin<?, String, ?> tr = root.joinMap("translations", JoinType.LEFT);
        String pattern = "%" + escape(q.trim().toLowerCase()) + "%";
        Predicate[] ps = java.util.Arrays.stream(fields).map(f -> cb.like(cb.lower(tr.value().get(f)), pattern, '\\')).toArray(Predicate[]::new);
        return cb.or(ps);
    }

    static Predicate isPublic(Root<?> root, CriteriaBuilder cb, Instant now) {
        return cb.and(root.get("status").in(Visibility.PUBLIC_STATUSES), cb.isNotNull(root.get("publishedAt")), cb.lessThanOrEqualTo(root.get("publishedAt"), now));
    }

    static Predicate statusIn(Root<?> root, Set<ContentStatus> statuses) { return root.get("status").in(statuses); }

    private static String escape(String s) { return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_"); }

    /** Only whitelisted sort fields are accepted (anything else falls back to the default). */
    static Pageable page(int page, int size, String sort, List<String> allowed, Sort defaultSort) {
        Sort s = defaultSort;
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.split(",");
            if (allowed.contains(parts[0])) s = Sort.by(parts.length > 1 && parts[1].equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, parts[0]);
        }
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), s);
    }
}
