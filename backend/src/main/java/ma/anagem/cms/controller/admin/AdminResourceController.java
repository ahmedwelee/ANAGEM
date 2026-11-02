package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.dto.PartnerDtos.*;
import ma.anagem.cms.dto.ResourceDtos.*;
import ma.anagem.cms.entity.ResourceKind;
import ma.anagem.cms.service.PartnerService;
import ma.anagem.cms.service.ResourceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminResourceController {
    private final ResourceService resources;
    private final PartnerService partners;

    @GetMapping("/resources") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public PageResponse<ResourceListItemDto> list(@RequestParam(required = false) ContentStatus status, @RequestParam(required = false) ResourceKind kind, @RequestParam(required = false) String q,
                                                  @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, @RequestParam(required = false) String sort, Lang lang) {
        return resources.adminList(status, kind, q, page, size, sort, lang);
    }

    @GetMapping("/resources/{id}") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public ResourceAdminDto get(@PathVariable Long id) { return resources.adminGet(id); }

    @PostMapping("/resources") @PreAuthorize("hasAuthority('CONTENT_WRITE')") @ResponseStatus(HttpStatus.CREATED)
    public ResourceAdminDto create(@Valid @RequestBody ResourceRequest r) { return resources.create(r); }

    @PutMapping("/resources/{id}") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public ResourceAdminDto update(@PathVariable Long id, @Valid @RequestBody ResourceRequest r) { return resources.update(id, r); }

    @DeleteMapping("/resources/{id}") @PreAuthorize("hasAuthority('CONTENT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) { resources.delete(id); return ResponseEntity.noContent().build(); }

    @PatchMapping("/resources/{id}/status") @PreAuthorize("hasAuthority('CONTENT_WRITE')")
    public ResourceAdminDto status(@PathVariable Long id, @Valid @RequestBody StatusChangeRequest r) { return resources.changeStatus(id, r); }

    @GetMapping("/partners") @PreAuthorize("hasAuthority('PARTNER_MANAGE')")
    public List<PartnerAdminDto> partners() { return partners.adminList(); }

    @PostMapping("/partners") @PreAuthorize("hasAuthority('PARTNER_MANAGE')") @ResponseStatus(HttpStatus.CREATED)
    public PartnerAdminDto createPartner(@Valid @RequestBody PartnerRequest r) { return partners.create(r); }

    @PutMapping("/partners/{id}") @PreAuthorize("hasAuthority('PARTNER_MANAGE')")
    public PartnerAdminDto updatePartner(@PathVariable Long id, @Valid @RequestBody PartnerRequest r) { return partners.update(id, r); }

    @DeleteMapping("/partners/{id}") @PreAuthorize("hasAuthority('PARTNER_MANAGE')")
    public ResponseEntity<Void> deletePartner(@PathVariable Long id) { partners.delete(id); return ResponseEntity.noContent().build(); }
}
