package ma.anagem.cms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "homepage_sections") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class HomepageSection {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 50) private String sectionKey;
    private boolean enabled = true;
    private int sortOrder;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false) private JsonNode content;
    @Version private long version;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "updated_by") private User updatedBy;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;
}
