package ma.anagem.cms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

/** Title + description translation used by publications and resources. */
@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class TitledText {
    @Column(nullable = false, length = 300) private String title;
    @Column(columnDefinition = "text") private String description;
}
