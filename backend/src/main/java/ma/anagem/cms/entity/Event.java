package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import lombok.*;

@Entity @Table(name = "events") @Getter @Setter @NoArgsConstructor
public class Event extends ContentBase {
    @Column(nullable = false, unique = true) private String slug;
    @Enumerated(EnumType.STRING) @Column(name = "event_type", nullable = false) private EventType eventType = EventType.OTHER;
    @Column(nullable = false) private Instant startsAt;
    private Instant endsAt;
    private boolean allDay;
    private String registrationUrl;
    private boolean featured;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "image_id") private MediaFile image;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "program_file_id") private MediaFile programFile;

    @ElementCollection @CollectionTable(name = "event_translations", joinColumns = @JoinColumn(name = "event_id"))
    @MapKeyColumn(name = "locale")
    private Map<String, EventText> translations = new HashMap<>();

    /** Upcoming/ongoing/past is derived from the dates, never stored. */
    public Instant effectiveEnd() { return endsAt != null ? endsAt : startsAt; }
}
