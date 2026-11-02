package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.NewsDtos.*;
import ma.anagem.cms.service.NewsService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/news")
@RequiredArgsConstructor
public class AdminNewsController {
    private final NewsService service;

    @GetMapping @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public PageResponse<NewsListItemDto> list(@RequestParam(required = false) ContentStatus status, @RequestParam(required = false) String q,
                                              @RequestParam(required = false) Long categoryId, @RequestParam(required = false) Boolean featured,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                              @RequestParam(required = false) String sort, Lang lang) {
        return service.adminList(status, q, categoryId, featured, page, size, sort, lang);
    }

    @GetMapping("/{id}") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public NewsAdminDto get(@PathVariable Long id) { return service.adminGet(id); }

    @GetMapping("/{id}/preview") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public NewsDetailDto preview(@PathVariable Long id, Lang lang) { return service.preview(id, lang); }

    @PostMapping @PreAuthorize("hasAuthority('CONTENT_WRITE')") @ResponseStatus(HttpStatus.CREATED)
    public NewsAdminDto create(@Valid @RequestBody NewsRequest r) { return service.create(r); }

    @PutMapping("/{id}") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public NewsAdminDto update(@PathVariable Long id, @Valid @RequestBody NewsRequest r) { return service.update(id, r); }

    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('CONTENT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PatchMapping("/{id}/status") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public NewsAdminDto status(@PathVariable Long id, @Valid @RequestBody StatusChangeRequest r) { return service.changeStatus(id, r); }

    @PatchMapping("/{id}/publish") @PreAuthorize("hasAuthority('CONTENT_PUBLISH')")
    public NewsAdminDto publish(@PathVariable Long id) { return service.changeStatus(id, new StatusChangeRequest(ContentStatus.PUBLISHED, null)); }
}
