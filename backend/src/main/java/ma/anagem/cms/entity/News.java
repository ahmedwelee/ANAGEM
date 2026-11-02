package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.util.*;
import lombok.*;

@Entity @Table(name = "news") @Getter @Setter @NoArgsConstructor
public class News extends ContentBase {
    @Column(nullable = false, unique = true) private String slug;
    private boolean featured;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "featured_image_id") private MediaFile featuredImage;

    @ElementCollection @CollectionTable(name = "news_translations", joinColumns = @JoinColumn(name = "news_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, NewsText> translations = new HashMap<>();

    @ElementCollection @CollectionTable(name = "news_tags", joinColumns = @JoinColumn(name = "news_id"))
    @Column(name = "tag", length = 60)
    private Set<String> tags = new LinkedHashSet<>();
}
