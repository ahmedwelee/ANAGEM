package ma.anagem.cms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable @Getter @Setter @NoArgsConstructor
public class MediaText {
    @Column(length = 500) private String altText;
    @Column(length = 1000) private String description;
}
