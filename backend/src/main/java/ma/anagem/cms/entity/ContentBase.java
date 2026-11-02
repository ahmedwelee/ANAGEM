package ma.anagem.cms.entity;

import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Visibility;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Shared columns of every editorial content type (news, publications, events, resources). */
@MappedSuperclass @Getter @Setter
@EntityListeners(AuditingEntityListener.class)
public abstract class ContentBase {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private ContentStatus status = ContentStatus.DRAFT;
    private Instant publishedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "category_id") private Category category;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "author_id") private User author;
    @Version private long version;
    @CreatedDate @Column(nullable = false, updatable = false) private Instant createdAt;
    @LastModifiedDate @Column(nullable = false) private Instant updatedAt;

    public boolean isPubliclyVisible(Instant now) { return Visibility.isPublic(status, publishedAt, now); }
}
