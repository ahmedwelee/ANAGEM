package ma.anagem.cms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PartnerText {
    @Column(nullable = false, length = 200) private String name;
}
