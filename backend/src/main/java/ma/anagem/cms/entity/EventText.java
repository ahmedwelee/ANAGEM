package ma.anagem.cms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable @Getter @Setter @NoArgsConstructor
public class EventText {
    @Column(nullable = false, length = 300) private String title;
    @Column(columnDefinition = "text") private String description;
    @Column(length = 300) private String location;
    @Column(length = 300) private String organizer;
}
