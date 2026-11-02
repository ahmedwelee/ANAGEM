package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity @Table(name = "media_files") @Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class MediaFile {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, unique = true) private String storageKey;
    private String thumbnailKey;
    @Column(nullable = false) private String originalName;
    @Column(nullable = false) private String contentType;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private MediaKind kind;
    @Column(nullable = false) private long sizeBytes;
    private Integer width;
    private Integer height;
    private String checksumSha256;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "uploaded_by") private User uploadedBy;
    @CreatedDate @Column(nullable = false, updatable = false) private Instant createdAt;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;

    @ElementCollection @CollectionTable(name = "media_file_translations", joinColumns = @JoinColumn(name = "media_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, MediaText> translations = new HashMap<>();
}
