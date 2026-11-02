package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity @Table(name = "audit_logs") @Getter @Setter @NoArgsConstructor
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Instant occurredAt = Instant.now();
    private Long actorId;
    private String actorEmail;
    @Column(nullable = false, length = 40) private String action;
    @Column(length = 40) private String resourceType;
    @Column(length = 64) private String resourceId;
    @Column(length = 500) private String summary;
    @Column(length = 64) private String ipAddress;
}
