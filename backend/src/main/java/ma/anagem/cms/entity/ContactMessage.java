package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "contact_messages") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class ContactMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 150) private String name;
    @Column(nullable = false) private String email;
    @Column(length = 250) private String subject;
    @Column(nullable = false, columnDefinition = "text") private String message;
    @Column(length = 8) private String locale;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private ContactStatus status = ContactStatus.NEW;
    @Column(length = 64) private String ipAddress;
    private Long handledBy;
    private Instant handledAt;
    @CreatedDate @Column(nullable = false, updatable = false) private Instant createdAt;
}
