package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.EventDtos.*;
import ma.anagem.cms.entity.EventType;
import ma.anagem.cms.service.EventService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/events")
@RequiredArgsConstructor
public class AdminEventController {
    private final EventService service;

    @GetMapping @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public PageResponse<EventListItemDto> list(@RequestParam(required = false) ContentStatus status, @RequestParam(required = false) EventType type,
                                               @RequestParam(required = false) Scope scope, @RequestParam(required = false) String q,
                                               @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                               @RequestParam(required = false) String sort, Lang lang) {
        return service.adminList(status, type, scope, q, page, size, sort, lang);
    }

    @GetMapping("/{id}") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public EventAdminDto get(@PathVariable Long id) { return service.adminGet(id); }

    @PostMapping @PreAuthorize("hasAuthority('CONTENT_WRITE')") @ResponseStatus(HttpStatus.CREATED)
    public EventAdminDto create(@Valid @RequestBody EventRequest r) { return service.create(r); }

    @PutMapping("/{id}") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public EventAdminDto update(@PathVariable Long id, @Valid @RequestBody EventRequest r) { return service.update(id, r); }

    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('CONTENT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @PatchMapping("/{id}/status") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public EventAdminDto status(@PathVariable Long id, @Valid @RequestBody StatusChangeRequest r) { return service.changeStatus(id, r); }

    @PatchMapping("/{id}/publish") @PreAuthorize("hasAuthority('CONTENT_PUBLISH')")
    public EventAdminDto publish(@PathVariable Long id) { return service.changeStatus(id, new StatusChangeRequest(ContentStatus.PUBLISHED, null)); }
}
