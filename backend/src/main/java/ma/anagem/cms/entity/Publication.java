package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.util.HashMap;
import java.util.Map;
import lombok.*;

@Entity @Table(name = "publications") @Getter @Setter @NoArgsConstructor
public class Publication extends ContentBase {
    @Enumerated(EnumType.STRING) @Column(nullable = false) private PublicationKind kind = PublicationKind.OTHER;
    @Column(name = "publication_year", nullable = false) private int publicationYear;
    private String issueNumber;
    private boolean featured;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "cover_image_id") private MediaFile coverImage;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "pdf_file_id") private MediaFile pdfFile;

    @ElementCollection @CollectionTable(name = "publication_translations", joinColumns = @JoinColumn(name = "publication_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, TitledText> translations = new HashMap<>();
}
