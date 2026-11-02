package ma.anagem.cms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "website_settings") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class WebsiteSetting {
    @Id @Column(name = "setting_key", length = 100) private String key;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false) private JsonNode value;
    @Column(name = "is_public", nullable = false) private boolean publicSetting;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "updated_by") private User updatedBy;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;
}
