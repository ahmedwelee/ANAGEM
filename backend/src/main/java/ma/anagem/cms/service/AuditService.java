package ma.anagem.cms.service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.entity.AuditLog;
import ma.anagem.cms.repository.AuditLogRepository;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditLogRepository repo;

    /** Records an action by the current user, inside the caller's transaction (rolled back with it). */
    @Transactional
    public void log(AuditAction action, String resourceType, Object resourceId, String summary) {
        var user = CurrentUser.get();
        save(action, user.map(u -> u.id()).orElse(null), user.map(u -> u.email()).orElse(null), resourceType, resourceId, summary);
    }

    /** Records an event that must survive a rollback (e.g. failed login). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logIndependent(AuditAction action, Long actorId, String actorEmail, String summary) {
        save(action, actorId, actorEmail, "USER", actorId, summary);
    }

    private void save(AuditAction action, Long actorId, String email, String type, Object id, String summary) {
        AuditLog l = new AuditLog();
        l.setAction(action.name());
        l.setActorId(actorId);
        l.setActorEmail(email);
        l.setResourceType(type);
        l.setResourceId(id == null ? null : String.valueOf(id));
        l.setSummary(summary != null && summary.length() > 500 ? summary.substring(0, 500) : summary);
        l.setIpAddress(clientIp());
        repo.save(l);
    }

    private String clientIp() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes a
                ? ((HttpServletRequest) a.getRequest()).getRemoteAddr() : null;
    }
}
