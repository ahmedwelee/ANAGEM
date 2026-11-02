package ma.anagem.cms.entity;

import ma.anagem.cms.common.Lang;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "users") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String email;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "full_name", nullable = false) private String fullName;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "role_id") private Role role;
    private boolean enabled = true;
    @Column(name = "preferred_locale", nullable = false) private String preferredLocale = Lang.DEFAULT.code();
    private Instant lastLoginAt;
    private int failedLoginAttempts;
    private Instant lockedUntil;
    @CreatedDate @Column(nullable = false, updatable = false) private Instant createdAt;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;
}
