package ma.anagem.cms.service;

import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.*;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.ResourceDtos.*;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.ResourceMapper;
import ma.anagem.cms.repository.*;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ResourceService {
    private static final List<String> SORTABLE = List.of("updatedAt", "createdAt", "publishedAt", "id");
    private final ResourceRepository repo;
    private final CategoryRepository categories;
    private final UserRepository users;
    private final MediaService media;
    private final HtmlSanitizer sanitizer;
    private final ContentWorkflow workflow;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public PageResponse<ResourceListItemDto> adminList(ContentStatus status, ResourceKind kind, String q, int page, int size, String sort, Lang lang) {
        Specification<Resource> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            if (kind != null) ps.add(cb.equal(root.get("kind"), kind));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.titleMatches(root, cb, q));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return PageResponse.of(repo.findAll(spec, SpecSupport.page(page, size, sort, SORTABLE, Sort.by(Sort.Direction.DESC, "updatedAt"))), r -> ResourceMapper.toListItem(r, lang));
    }

    @Transactional(readOnly = true)
    public ResourceAdminDto adminGet(Long id) { return ResourceMapper.toAdmin(find(id)); }

    @Transactional
    public ResourceAdminDto create(ResourceRequest r) {
        Resource e = new Resource();
        e.setAuthor(users.getReferenceById(CurrentUser.require().id()));
        apply(e, r);
        repo.save(e);
        audit.log(AuditAction.CREATE, "RESOURCE", e.getId(), "Created resource (" + e.getKind() + ")");
        return ResourceMapper.toAdmin(e);
    }

    @Transactional
    public ResourceAdminDto update(Long id, ResourceRequest r) {
        Resource e = find(id);
        workflow.assertEditable(e);
        apply(e, r);
        audit.log(AuditAction.UPDATE, "RESOURCE", id, "Updated resource " + id);
        repo.flush();
        return ResourceMapper.toAdmin(e);
    }

    @Transactional
    public void delete(Long id) {
        Resource e = find(id);
        workflow.assertEditable(e);
        repo.delete(e);
        audit.log(AuditAction.DELETE, "RESOURCE", id, "Deleted resource " + id);
    }

    @Transactional
    public ResourceAdminDto changeStatus(Long id, StatusChangeRequest r) {
        Resource e = find(id);
        if ((r.status() == ContentStatus.PUBLISHED || r.status() == ContentStatus.SCHEDULED) && e.getFile() == null && e.getExternalUrl() == null) {
            throw ApiException.badRequest("RESOURCE_EMPTY", "Attach a file or an external link before publishing");
        }
        ContentStatus before = e.getStatus();
        workflow.changeStatus(e, r, e.getTranslations().values().stream().anyMatch(t -> t.getTitle() != null && !t.getTitle().isBlank()));
        audit.log(AuditAction.STATUS_CHANGE, "RESOURCE", id, before + " -> " + e.getStatus());
        return ResourceMapper.toAdmin(e);
    }

    @Transactional(readOnly = true)
    public PageResponse<ResourceCardDto> publicList(Lang lang, String q, ResourceKind kind, Long categoryId, int page, int size) {
        Instant now = Instant.now();
        Specification<Resource> spec = (root, cq, cb) -> {
            cq.distinct(true);
            List<Predicate> ps = new ArrayList<>();
            ps.add(SpecSupport.isPublic(root, cb, now));
            if (q != null && !q.isBlank()) ps.add(SpecSupport.titleMatches(root, cb, q));
            if (kind != null) ps.add(cb.equal(root.get("kind"), kind));
            if (categoryId != null) ps.add(cb.equal(root.get("category").get("id"), categoryId));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, SpecSupport.page(page, size, null, SORTABLE, Sort.by(Sort.Direction.DESC, "publishedAt").and(Sort.by(Sort.Direction.DESC, "id"))));
        return new PageResponse<>(pg.getContent().stream().map(r -> ResourceMapper.toCard(r, lang)).filter(Objects::nonNull).toList(), pg.getNumber(), pg.getSize(), pg.getTotalElements(), pg.getTotalPages());
    }

    @Transactional(readOnly = true)
    public ResourceCardDto detail(Long id, Lang lang) {
        Resource r = repo.findById(id).filter(ContentWorkflow::isPublic).orElseThrow(() -> ApiException.notFound("Resource"));
        ResourceCardDto d = ResourceMapper.toCard(r, lang);
        if (d == null) throw ApiException.notFound("Resource");
        return d;
    }

    private Resource find(Long id) { return repo.findById(id).orElseThrow(() -> ApiException.notFound("Resource")); }

    private void apply(Resource e, ResourceRequest r) {
        ContentWorkflow.requireSupported(r.translations().keySet());
        Map<String, TitledText> built = new LinkedHashMap<>();
        r.translations().forEach((locale, d) -> {
            boolean empty = (d.title() == null || d.title().isBlank()) && (d.description() == null || d.description().isBlank());
            if (empty) return;
            if (d.title() == null || d.title().isBlank()) throw ApiException.badRequest("TITLE_REQUIRED", "A title is required for the '" + locale + "' version");
            built.put(locale, new TitledText(d.title().trim(), sanitizer.clean(d.description())));
        });
        if (built.isEmpty()) throw ApiException.badRequest("NO_TRANSLATION", "At least one language version with a title is required");
        e.getTranslations().clear();
        e.getTranslations().putAll(built);
        e.setKind(r.kind());
        e.setExternalUrl(r.externalUrl() == null || r.externalUrl().isBlank() ? null : r.externalUrl().trim());
        e.setCategory(r.categoryId() == null ? null : categories.findById(r.categoryId()).filter(c -> c.getType() == CategoryType.RESOURCE)
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_CATEGORY", "Unknown resource category")));
        e.setFile(media.require(r.fileId(), null, "fileId"));
    }
}
