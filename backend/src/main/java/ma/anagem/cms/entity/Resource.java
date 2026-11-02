package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.util.HashMap;
import java.util.Map;
import lombok.*;

@Entity @Table(name = "resources") @Getter @Setter @NoArgsConstructor
public class Resource extends ContentBase {
    @Enumerated(EnumType.STRING) @Column(nullable = false) private ResourceKind kind = ResourceKind.DOCUMENT;
    private String externalUrl;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "file_id") private MediaFile file;

    @ElementCollection @CollectionTable(name = "resource_translations", joinColumns = @JoinColumn(name = "resource_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, TitledText> translations = new HashMap<>();
}
