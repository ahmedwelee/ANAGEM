package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.OpsDtos.*;
import ma.anagem.cms.entity.ContactStatus;
import ma.anagem.cms.service.ContactService;
import ma.anagem.cms.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminOpsController {
    private final DashboardService dashboard;
    private final ContactService contacts;

    @GetMapping("/dashboard/statistics") @PreAuthorize("hasAuthority('DASHBOARD_VIEW')")
    public DashboardStats statistics() { return dashboard.statistics(); }

    @GetMapping("/dashboard/recent-activity") @PreAuthorize("hasAuthority('DASHBOARD_VIEW')")
    public List<AuditLogDto> recent(@RequestParam(defaultValue = "15") int limit) { return dashboard.recentActivity(limit); }

    @GetMapping("/audit-logs") @PreAuthorize("hasAuthority('AUDIT_VIEW')")
    public PageResponse<AuditLogDto> audit(@RequestParam(required = false) String actor, @RequestParam(required = false) String action, @RequestParam(required = false) String resourceType,
                                           @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return dashboard.auditLog(actor, action, resourceType, from, to, page, size);
    }

    @GetMapping("/contact-messages") @PreAuthorize("hasAuthority('MESSAGES_VIEW')")
    public PageResponse<ContactMessageDto> messages(@RequestParam(required = false) ContactStatus status, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return contacts.list(status, page, size);
    }

    @PatchMapping("/contact-messages/{id}") @PreAuthorize("hasAuthority('MESSAGES_VIEW')")
    public ContactMessageDto setStatus(@PathVariable Long id, @Valid @RequestBody UpdateContactStatusRequest r) { return contacts.setStatus(id, r.status()); }

    @DeleteMapping("/contact-messages/{id}") @PreAuthorize("hasAuthority('MESSAGES_VIEW')")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long id) { contacts.delete(id); return ResponseEntity.noContent().build(); }
}
