package ma.anagem.cms.service;

import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.*;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.NewsDtos.*;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.NewsMapper;
import ma.anagem.cms.repository.*;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NewsService {
    private static final List<String> SORTABLE = List.of("updatedAt", "createdAt", "publishedAt", "id");
    private final NewsRepository repo;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final MediaService media;
    private final HtmlSanitizer sanitizer;
    private final ContentWorkflow workflow;
    private final AuditService audit;

    // ---------------- admin ----------------
    @Transactional(readOnly = true)
    public PageResponse<NewsListItemDto> adminList(ContentStatus status, String q, Long categoryId, Boolean featured, int page, int size, String sort, Lang lang) {
        Specification<News> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            if (categoryId != null) ps.add(cb.equal(root.get("category").get("id"), categoryId));
            if (featured != null) ps.add(cb.equal(root.get("featured"), featured));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.textMatches(root, cb, q, "title", "summary"));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, SpecSupport.page(page, size, sort, SORTABLE, Sort.by(Sort.Direction.DESC, "updatedAt")));
        return PageResponse.of(pg, n -> NewsMapper.toListItem(n, lang));
    }

    @Transactional(readOnly = true)
    public NewsAdminDto adminGet(Long id) { return NewsMapper.toAdmin(find(id)); }

    @Transactional
    public NewsAdminDto create(NewsRequest r) {
        News n = new News();
        n.setAuthor(users.getReferenceById(CurrentUser.require().id()));
        apply(n, r);
        n.setSlug(newSlug(r.slug(), n));
        repo.save(n);
        audit.log(AuditAction.CREATE, "NEWS", n.getId(), "Created news " + n.getSlug());
        return NewsMapper.toAdmin(n);
    }

    @Transactional
    public NewsAdminDto update(Long id, NewsRequest r) {
        News n = find(id);
        workflow.assertEditable(n);
        apply(n, r);
        if (r.slug() != null && !r.slug().equals(n.getSlug())) {
            if (repo.existsBySlug(r.slug())) throw ApiException.conflict("SLUG_TAKEN", "Another article already uses this slug");
            n.setSlug(r.slug());
        }
        audit.log(AuditAction.UPDATE, "NEWS", id, "Updated news " + n.getSlug());
        repo.flush();
        return NewsMapper.toAdmin(n);
    }

    @Transactional
    public void delete(Long id) {
        News n = find(id);
        workflow.assertEditable(n);
        repo.delete(n);
        audit.log(AuditAction.DELETE, "NEWS", id, "Deleted news " + n.getSlug());
    }

    @Transactional
    public NewsAdminDto changeStatus(Long id, StatusChangeRequest r) {
        News n = find(id);
        ContentStatus before = n.getStatus();
        workflow.changeStatus(n, r, n.getTranslations().values().stream().anyMatch(t -> t.getTitle() != null && !t.getTitle().isBlank()));
        audit.log(AuditAction.STATUS_CHANGE, "NEWS", id, n.getSlug() + ": " + before + " -> " + n.getStatus());
        return NewsMapper.toAdmin(n);
    }

    @Transactional(readOnly = true)
    public NewsDetailDto preview(Long id, Lang lang) {
        NewsDetailDto d = NewsMapper.toDetail(find(id), lang);
        if (d == null) throw ApiException.badRequest("NO_TRANSLATION", "Add a title in at least one language to preview");
        return d;
    }

    // ---------------- public ----------------
    @Transactional(readOnly = true)
    public PageResponse<NewsCardDto> publicList(Lang lang, String q, String categorySlug, String tag, Boolean featured, int page, int size) {
        Instant now = Instant.now();
        Specification<News> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            ps.add(SpecSupport.isPublic(root, cb, now));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.textMatches(root, cb, q, "title", "summary"));
            if (categorySlug != null && !categorySlug.isBlank()) ps.add(cb.equal(root.get("category").get("slug"), categorySlug));
            if (tag != null && !tag.isBlank()) ps.add(cb.equal(root.join("tags"), tag.trim().toLowerCase()));
            if (featured != null) ps.add(cb.equal(root.get("featured"), featured));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, SpecSupport.page(page, size, null, SORTABLE, Sort.by(Sort.Direction.DESC, "publishedAt").and(Sort.by(Sort.Direction.DESC, "id"))));
        return new PageResponse<>(pg.getContent().stream().map(n -> NewsMapper.toCard(n, lang)).filter(Objects::nonNull).toList(), pg.getNumber(), pg.getSize(), pg.getTotalElements(), pg.getTotalPages());
    }

    @Transactional(readOnly = true)
    public List<NewsCardDto> featured(Lang lang, int limit) { return publicList(lang, null, null, null, true, 0, Math.min(Math.max(limit, 1), 20)).content(); }

    @Transactional(readOnly = true)
    public NewsDetailDto detail(String slug, Lang lang) {
        News n = repo.findBySlug(slug).filter(ContentWorkflow::isPublic).orElseThrow(() -> ApiException.notFound("Article"));
        NewsDetailDto d = NewsMapper.toDetail(n, lang);
        if (d == null) throw ApiException.notFound("Article");
        return d;
    }

    @Transactional(readOnly = true)
    public List<NewsCardDto> related(String slug, Lang lang, int limit) {
        News n = repo.findBySlug(slug).filter(ContentWorkflow::isPublic).orElseThrow(() -> ApiException.notFound("Article"));
        Instant now = Instant.now();
        Set<String> tags = n.getTags();
        Specification<News> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            ps.add(SpecSupport.isPublic(root, cb, now));
            ps.add(cb.notEqual(root.get("id"), n.getId()));
            List<Predicate> any = new ArrayList<>();
            if (n.getCategory() != null) any.add(cb.equal(root.get("category").get("id"), n.getCategory().getId()));
            if (!tags.isEmpty()) any.add(root.join("tags", jakarta.persistence.criteria.JoinType.LEFT).in(tags));
            if (any.isEmpty()) return cb.disjunction();
            ps.add(cb.or(any.toArray(new Predicate[0])));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return repo.findAll(spec, SpecSupport.page(0, Math.min(Math.max(limit, 1), 12), null, SORTABLE, Sort.by(Sort.Direction.DESC, "publishedAt")))
                .stream().map(x -> ma.anagem.cms.mapper.NewsMapper.toCard(x, lang)).filter(Objects::nonNull).toList();
    }

    // ---------------- helpers ----------------
    private News find(Long id) { return repo.findById(id).orElseThrow(() -> ApiException.notFound("Article")); }

    private void apply(News n, NewsRequest r) {
        ContentWorkflow.requireSupported(r.translations().keySet());
        Map<String, NewsText> built = new LinkedHashMap<>();
        r.translations().forEach((locale, d) -> {
            boolean empty = isBlank(d.title()) && isBlank(d.summary()) && isBlank(d.content());
            if (empty) return;
            if (isBlank(d.title())) throw ApiException.badRequest("TITLE_REQUIRED", "A title is required for the '" + locale + "' version");
            NewsText t = new NewsText();
            t.setTitle(d.title().trim());
            t.setSummary(blankToNull(d.summary()));
            t.setContent(sanitizer.clean(d.content()));
            t.setSeoTitle(blankToNull(d.seoTitle()));
            t.setSeoDescription(blankToNull(d.seoDescription()));
            built.put(locale, t);
        });
        if (built.isEmpty()) throw ApiException.badRequest("NO_TRANSLATION", "At least one language version with a title is required");
        n.getTranslations().clear();
        n.getTranslations().putAll(built);
        n.setCategory(r.categoryId() == null ? null : categories.findById(r.categoryId()).filter(c -> c.getType() == CategoryType.NEWS)
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_CATEGORY", "Unknown news category")));
        n.setFeaturedImage(media.require(r.featuredImageId(), MediaKind.IMAGE, "featuredImageId"));
        n.setFeatured(Boolean.TRUE.equals(r.featured()));
        Set<String> tags = new LinkedHashSet<>();
        if (r.tags() != null) r.tags().stream().map(s -> s.trim().toLowerCase()).filter(s -> !s.isEmpty()).limit(20).forEach(tags::add);
        n.getTags().clear();
        n.getTags().addAll(tags);
    }

    private String newSlug(String requested, News n) {
        if (requested != null && !requested.isBlank()) {
            if (repo.existsBySlug(requested)) throw ApiException.conflict("SLUG_TAKEN", "Another article already uses this slug");
            return requested;
        }
        String title = Arrays.stream(Lang.values()).map(l -> n.getTranslations().get(l.code())).filter(Objects::nonNull).map(NewsText::getTitle)
                .filter(t -> !Slugs.slugify(t).startsWith("item-")).findFirst().orElse(null);
        return Slugs.unique(Slugs.slugify(title), repo::existsBySlug);
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static String blankToNull(String s) { return isBlank(s) ? null : s.trim(); }
}
