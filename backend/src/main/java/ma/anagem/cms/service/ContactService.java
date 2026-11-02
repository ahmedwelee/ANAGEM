package ma.anagem.cms.service;

import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.OpsDtos.*;
import ma.anagem.cms.entity.ContactMessage;
import ma.anagem.cms.entity.ContactStatus;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.repository.ContactMessageRepository;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ContactService {
    private final ContactMessageRepository repo;
    private final AuditService audit;

    /** Stores a message from the public form. A filled honeypot is silently dropped (bots think it worked). */
    @Transactional
    public void submit(ContactRequest r, HttpServletRequest http) {
        if (r.website() != null && !r.website().isBlank()) return;
        ContactMessage m = new ContactMessage();
        m.setName(clean(r.name()));
        m.setEmail(r.email().trim().toLowerCase());
        m.setSubject(r.subject() == null || r.subject().isBlank() ? null : clean(r.subject()));
        m.setMessage(r.message().replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", "").trim());
        m.setLocale(r.locale());
        m.setIpAddress(http.getRemoteAddr());
        repo.save(m);
    }

    @Transactional(readOnly = true)
    public PageResponse<ContactMessageDto> list(ContactStatus status, int page, int size) {
        Specification<ContactMessage> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var pg = repo.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(pg, this::toDto);
    }

    @Transactional
    public ContactMessageDto setStatus(Long id, ContactStatus status) {
        ContactMessage m = repo.findById(id).orElseThrow(() -> ApiException.notFound("Message"));
        m.setStatus(status);
        m.setHandledBy(CurrentUser.require().id());
        m.setHandledAt(Instant.now());
        audit.log(AuditAction.UPDATE, "CONTACT_MESSAGE", id, "Marked " + status);
        return toDto(m);
    }

    @Transactional
    public void delete(Long id) {
        ContactMessage m = repo.findById(id).orElseThrow(() -> ApiException.notFound("Message"));
        repo.delete(m);
        audit.log(AuditAction.DELETE, "CONTACT_MESSAGE", id, "Deleted message from " + m.getEmail());
    }

    private static String clean(String s) { return s.replaceAll("\\p{Cntrl}", " ").trim(); }

    private ContactMessageDto toDto(ContactMessage m) {
        return new ContactMessageDto(m.getId(), m.getName(), m.getEmail(), m.getSubject(), m.getMessage(), m.getLocale(), m.getStatus(), m.getCreatedAt(), m.getHandledAt());
    }
}
