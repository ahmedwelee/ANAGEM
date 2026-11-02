package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "partners") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Partner {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String name;
    private String websiteUrl;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "logo_id") private MediaFile logo;
    private int sortOrder;
    private boolean active = true;
    @CreatedDate @Column(nullable = false, updatable = false) private Instant createdAt;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;

    @ElementCollection @CollectionTable(name = "partner_translations", joinColumns = @JoinColumn(name = "partner_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, PartnerText> translations = new HashMap<>();
}
