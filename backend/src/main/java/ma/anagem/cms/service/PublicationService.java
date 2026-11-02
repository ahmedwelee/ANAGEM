package ma.anagem.cms.service;

import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.*;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.PublicationDtos.*;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.PublicationMapper;
import ma.anagem.cms.repository.*;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicationService {
    private static final List<String> SORTABLE = List.of("updatedAt", "createdAt", "publishedAt", "publicationYear", "id");
    private final PublicationRepository repo;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final MediaService media;
    private final HtmlSanitizer sanitizer;
    private final ContentWorkflow workflow;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public PageResponse<PublicationListItemDto> adminList(ContentStatus status, PublicationKind kind, String q, Integer year, int page, int size, String sort, Lang lang) {
        Specification<Publication> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            if (kind != null) ps.add(cb.equal(root.get("kind"), kind));
            if (year != null) ps.add(cb.equal(root.get("publicationYear"), year));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.titleMatches(root, cb, q));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, SpecSupport.page(page, size, sort, SORTABLE, Sort.by(Sort.Direction.DESC, "updatedAt")));
        return PageResponse.of(pg, p -> PublicationMapper.toListItem(p, lang));
    }

    @Transactional(readOnly = true)
    public PublicationAdminDto adminGet(Long id) { return PublicationMapper.toAdmin(find(id)); }

    @Transactional
    public PublicationAdminDto create(PublicationRequest r) {
        Publication p = new Publication();
        p.setAuthor(users.getReferenceById(CurrentUser.require().id()));
        apply(p, r);
        repo.save(p);
        audit.log(AuditAction.CREATE, "PUBLICATION", p.getId(), "Created publication (" + p.getKind() + " " + p.getPublicationYear() + ")");
        return PublicationMapper.toAdmin(p);
    }

    @Transactional
    public PublicationAdminDto update(Long id, PublicationRequest r) {
        Publication p = find(id);
        workflow.assertEditable(p);
        apply(p, r);
        audit.log(AuditAction.UPDATE, "PUBLICATION", id, "Updated publication " + id);
        repo.flush();
        return PublicationMapper.toAdmin(p);
    }

    @Transactional
    public void delete(Long id) {
        Publication p = find(id);
        workflow.assertEditable(p);
        repo.delete(p);
        audit.log(AuditAction.DELETE, "PUBLICATION", id, "Deleted publication " + id);
    }

    @Transactional
    public PublicationAdminDto changeStatus(Long id, StatusChangeRequest r) {
        Publication p = find(id);
        ContentStatus before = p.getStatus();
        workflow.changeStatus(p, r, p.getTranslations().values().stream().anyMatch(t -> t.getTitle() != null && !t.getTitle().isBlank()));
        audit.log(AuditAction.STATUS_CHANGE, "PUBLICATION", id, before + " -> " + p.getStatus());
        return PublicationMapper.toAdmin(p);
    }

    // ---------- public ----------
    @Transactional(readOnly = true)
    public PageResponse<PublicationCardDto> publicList(Lang lang, String q, Integer year, Long categoryId, PublicationKind kind, Boolean featured, int page, int size) {
        Instant now = Instant.now();
        Specification<Publication> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            ps.add(SpecSupport.isPublic(root, cb, now));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.titleMatches(root, cb, q));
            if (year != null) ps.add(cb.equal(root.get("publicationYear"), year));
            if (categoryId != null) ps.add(cb.equal(root.get("category").get("id"), categoryId));
            if (kind != null) ps.add(cb.equal(root.get("kind"), kind));
            if (featured != null) ps.add(cb.equal(root.get("featured"), featured));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, SpecSupport.page(page, size, null, SORTABLE, Sort.by(Sort.Direction.DESC, "publicationYear").and(Sort.by(Sort.Direction.DESC, "publishedAt")).and(Sort.by(Sort.Direction.DESC, "id"))));
        return new PageResponse<>(pg.getContent().stream().map(p -> PublicationMapper.toCard(p, lang)).filter(Objects::nonNull).toList(), pg.getNumber(), pg.getSize(), pg.getTotalElements(), pg.getTotalPages());
    }

    @Transactional(readOnly = true)
    public PublicationCardDto detail(Long id, Lang lang) {
        Publication p = repo.findById(id).filter(ContentWorkflow::isPublic).orElseThrow(() -> ApiException.notFound("Publication"));
        PublicationCardDto d = PublicationMapper.toCard(p, lang);
        if (d == null) throw ApiException.notFound("Publication");
        return d;
    }

    @Transactional(readOnly = true)
    public List<Integer> publicYears() { return repo.publicYears(Visibility.PUBLIC_STATUSES, Instant.now()); }

    /** Latest featured (else latest) journal issue, used by the homepage magazine block. */
    @Transactional(readOnly = true)
    public Optional<PublicationCardDto> latestMagazineIssue(Lang lang) {
        var featured = publicList(lang, null, null, null, PublicationKind.MAGAZINE_ISSUE, true, 0, 1).content();
        if (!featured.isEmpty()) return Optional.of(featured.get(0));
        return publicList(lang, null, null, null, PublicationKind.MAGAZINE_ISSUE, null, 0, 1).content().stream().findFirst();
    }

    @Transactional(readOnly = true)
    public Optional<PublicationCardDto> byId(Long id, Lang lang) {
        return repo.findById(id).filter(ContentWorkflow::isPublic).map(p -> PublicationMapper.toCard(p, lang));
    }

    // ---------- helpers ----------
    private Publication find(Long id) { return repo.findById(id).orElseThrow(() -> ApiException.notFound("Publication")); }

    private void apply(Publication p, PublicationRequest r) {
        ContentWorkflow.requireSupported(r.translations().keySet());
        Map<String, TitledText> built = new LinkedHashMap<>();
        r.translations().forEach((locale, d) -> {
            boolean empty = (d.title() == null || d.title().isBlank()) && (d.description() == null || d.description().isBlank());
            if (empty) return;
            if (d.title() == null || d.title().isBlank()) throw ApiException.badRequest("TITLE_REQUIRED", "A title is required for the '" + locale + "' version");
            built.put(locale, new TitledText(d.title().trim(), sanitizer.clean(d.description())));
        });
        if (built.isEmpty()) throw ApiException.badRequest("NO_TRANSLATION", "At least one language version with a title is required");
        p.getTranslations().clear();
        p.getTranslations().putAll(built);
        p.setKind(r.kind());
        p.setPublicationYear(r.year());
        p.setIssueNumber(r.issueNumber() == null || r.issueNumber().isBlank() ? null : r.issueNumber().trim());
        p.setFeatured(Boolean.TRUE.equals(r.featured()));
        p.setCategory(r.categoryId() == null ? null : categories.findById(r.categoryId()).filter(c -> c.getType() == CategoryType.PUBLICATION)
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_CATEGORY", "Unknown publication category")));
        p.setCoverImage(media.require(r.coverImageId(), MediaKind.IMAGE, "coverImageId"));
        p.setPdfFile(media.require(r.pdfFileId(), MediaKind.PDF, "pdfFileId"));
    }
}
