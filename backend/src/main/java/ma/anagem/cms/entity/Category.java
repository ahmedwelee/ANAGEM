package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "categories") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Category {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private CategoryType type;
    @Column(nullable = false) private String slug;
    private int sortOrder;
    private boolean active = true;
    @CreatedDate @Column(nullable = false, updatable = false) private Instant createdAt;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;

    @ElementCollection @CollectionTable(name = "category_translations", joinColumns = @JoinColumn(name = "category_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, CategoryText> translations = new HashMap<>();
}
