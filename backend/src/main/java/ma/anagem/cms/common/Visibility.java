package ma.anagem.cms.common;

import java.time.Instant;
import java.util.List;

public final class Visibility {
    private Visibility() {}

    /** Statuses that may be shown publicly once publishedAt has passed (SCHEDULED items go live by date alone). */
    public static final List<ContentStatus> PUBLIC_STATUSES = List.of(ContentStatus.PUBLISHED, ContentStatus.SCHEDULED);

    public static boolean isPublic(ContentStatus status, Instant publishedAt, Instant now) {
        return PUBLIC_STATUSES.contains(status) && publishedAt != null && !publishedAt.isAfter(now);
    }
}
