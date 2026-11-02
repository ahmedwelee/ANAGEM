package ma.anagem.cms.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Slugs;
import ma.anagem.cms.dto.CategoryDtos.*;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.CategoryMapper;
import ma.anagem.cms.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CategoryService {
    private final CategoryRepository categories;
    private final NewsRepository news;
    private final PublicationRepository publications;
    private final EventRepository events;
    private final ResourceRepository resources;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<CategoryDto> publicList(CategoryType type, Lang lang) {
        return categories.findByTypeAndActiveTrueOrderBySortOrderAscIdAsc(type).stream().map(c -> CategoryMapper.toDto(c, lang)).toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryAdminDto> adminList(CategoryType type) {
        List<Category> list = type == null ? categories.findAll() : categories.findByTypeOrderBySortOrderAscIdAsc(type);
        return list.stream().sorted(java.util.Comparator.comparing(Category::getType).thenComparingInt(Category::getSortOrder).thenComparing(Category::getId)).map(this::toAdmin).toList();
    }

    @Transactional
    public CategoryAdminDto create(CategoryRequest r) {
        Category c = new Category();
        c.setType(r.type());
        c.setSlug(uniqueSlug(r.type(), r.slug(), r, null));
        apply(c, r);
        categories.save(c);
        audit.log(AuditAction.CREATE, "CATEGORY", c.getId(), r.type() + " category " + c.getSlug());
        return toAdmin(c);
    }

    @Transactional
    public CategoryAdminDto update(Long id, CategoryRequest r) {
        Category c = categories.findById(id).orElseThrow(() -> ApiException.notFound("Category"));
        if (c.getType() != r.type()) throw ApiException.badRequest("TYPE_IMMUTABLE", "A category's type cannot be changed");
        if (r.slug() != null && !r.slug().equals(c.getSlug())) c.setSlug(uniqueSlug(c.getType(), r.slug(), r, c.getId()));
        apply(c, r);
        audit.log(AuditAction.UPDATE, "CATEGORY", id, "Updated category " + c.getSlug());
        return toAdmin(c);
    }

    @Transactional
    public void delete(Long id) {
        Category c = categories.findById(id).orElseThrow(() -> ApiException.notFound("Category"));
        long uses = usage(c);
        if (uses > 0) throw ApiException.conflict("CATEGORY_IN_USE", "This category is used by " + uses + " item(s); reassign them first");
        categories.delete(c);
        audit.log(AuditAction.DELETE, "CATEGORY", id, "Deleted category " + c.getSlug());
    }

    private void apply(Category c, CategoryRequest r) {
        ContentWorkflow.requireSupported(r.translations().keySet());
        c.getTranslations().clear();
        r.translations().forEach((k, v) -> c.getTranslations().put(k, new CategoryText(v.name().trim(), v.description())));
        if (r.sortOrder() != null) c.setSortOrder(r.sortOrder());
        if (r.active() != null) c.setActive(r.active());
    }

    private String uniqueSlug(CategoryType type, String requested, CategoryRequest r, Long selfId) {
        String base = requested != null && !requested.isBlank() ? requested : Slugs.slugify(firstName(r));
        if (requested != null && !requested.isBlank()) {
            categories.findByTypeAndSlug(type, base).filter(x -> !x.getId().equals(selfId)).ifPresent(x -> { throw ApiException.conflict("SLUG_TAKEN", "Another category already uses this slug"); });
            return base;
        }
        return Slugs.unique(base, s -> categories.existsByTypeAndSlug(type, s));
    }

    private String firstName(CategoryRequest r) {
        for (String l : List.of("fr", "en", "ar")) { var t = r.translations().get(l); if (t != null && t.name() != null) return t.name(); }
        return r.translations().values().iterator().next().name();
    }

    private long usage(Category c) {
        return switch (c.getType()) {
            case NEWS -> news.countByCategory_Id(c.getId());
            case PUBLICATION -> publications.countByCategory_Id(c.getId());
            case EVENT -> events.countByCategory_Id(c.getId());
            case RESOURCE -> resources.countByCategory_Id(c.getId());
        };
    }

    private CategoryAdminDto toAdmin(Category c) {
        Map<String, CategoryTextDto> tr = new LinkedHashMap<>();
        c.getTranslations().forEach((k, v) -> tr.put(k, new CategoryTextDto(v.getName(), v.getDescription())));
        return new CategoryAdminDto(c.getId(), c.getType(), c.getSlug(), c.getSortOrder(), c.isActive(), tr, usage(c));
    }
}
