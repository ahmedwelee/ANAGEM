package ma.anagem.cms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable @Getter @Setter @NoArgsConstructor
public class NewsText {
    @Column(nullable = false, length = 300) private String title;
    @Column(length = 1000) private String summary;
    @Column(columnDefinition = "text") private String content;
    @Column(length = 300) private String seoTitle;
    @Column(length = 500) private String seoDescription;
}
