package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity @Table(name = "revoked_tokens") @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class RevokedToken {
    @Id @Column(length = 64) private String jti;
    @Column(nullable = false) private Instant expiresAt;
}
