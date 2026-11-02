package ma.anagem.cms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class CategoryText {
    @Column(nullable = false, length = 150) private String name;
    @Column(length = 500) private String description;
}
