package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.dto.CategoryDtos.*;
import ma.anagem.cms.entity.CategoryType;
import ma.anagem.cms.service.CategoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
public class AdminCategoryController {
    private final CategoryService service;

    @GetMapping @PreAuthorize("hasAuthority('CONTENT_WRITE') or hasAuthority('CATEGORY_MANAGE')")
    public List<CategoryAdminDto> list(@RequestParam(required = false) CategoryType type) { return service.adminList(type); }

    @PostMapping @PreAuthorize("hasAuthority('CATEGORY_MANAGE')") @ResponseStatus(HttpStatus.CREATED)
    public CategoryAdminDto create(@Valid @RequestBody CategoryRequest r) { return service.create(r); }

    @PutMapping("/{id}") @PreAuthorize("hasAuthority('CATEGORY_MANAGE')")
    public CategoryAdminDto update(@PathVariable Long id, @Valid @RequestBody CategoryRequest r) { return service.update(id, r); }

    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('CATEGORY_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
