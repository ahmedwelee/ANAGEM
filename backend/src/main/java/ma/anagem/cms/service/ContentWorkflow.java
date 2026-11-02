package ma.anagem.cms.service;

import java.time.Instant;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Visibility;
import ma.anagem.cms.dto.ContentDtos.StatusChangeRequest;
import ma.anagem.cms.entity.ContentBase;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.stereotype.Component;

/**
 * Editorial rules shared by news, publications, events and resources.
 * Writers (EDITOR) move content between DRAFT and PENDING_REVIEW; only holders of CONTENT_PUBLISH can make it live,
 * schedule it, archive it, or touch anything that is already live.
 */
@Component
public class ContentWorkflow {

    /** Call before any edit/delete: live content may only be changed by a publisher. */
    public void assertEditable(ContentBase c) {
        boolean live = c.getStatus() == ContentStatus.PUBLISHED || c.getStatus() == ContentStatus.SCHEDULED;
        if (live && !CurrentUser.can("CONTENT_PUBLISH")) {
            throw ApiException.forbidden("PUBLISHED_CONTENT_LOCKED", "Published content can only be edited by an administrator");
        }
    }

    public void changeStatus(ContentBase c, StatusChangeRequest r, boolean hasTranslation) {
        ContentStatus target = r.status();
        boolean publisher = CurrentUser.can("CONTENT_PUBLISH");
        switch (target) {
            case DRAFT, PENDING_REVIEW -> assertEditable(c);
            case PUBLISHED, SCHEDULED, ARCHIVED -> {
                if (!publisher) throw ApiException.forbidden("PUBLISH_FORBIDDEN", "Only administrators can publish, schedule or archive content");
            }
        }
        if (target != ContentStatus.DRAFT && !hasTranslation) {
            throw ApiException.badRequest("NO_TRANSLATION", "At least one language version with a title is required");
        }
        Instant now = Instant.now();
        switch (target) {
            case PUBLISHED -> {
                if (r.publishedAt() != null && r.publishedAt().isAfter(now)) throw ApiException.badRequest("USE_SCHEDULED", "Use SCHEDULED for a future publication date");
                if (r.publishedAt() != null) c.setPublishedAt(r.publishedAt());
                else if (c.getPublishedAt() == null || c.getStatus() != ContentStatus.PUBLISHED && c.getPublishedAt().isAfter(now)) c.setPublishedAt(now);
            }
            case SCHEDULED -> {
                if (r.publishedAt() == null || !r.publishedAt().isAfter(now)) throw ApiException.badRequest("SCHEDULE_IN_PAST", "A scheduled item needs a future publication date");
                c.setPublishedAt(r.publishedAt());
            }
            default -> { }
        }
        c.setStatus(target);
    }

    public static boolean isPublic(ContentBase c) { return Visibility.isPublic(c.getStatus(), c.getPublishedAt(), Instant.now()); }

    public static void requireSupported(Iterable<String> locales) {
        for (String l : locales) if (!Lang.isSupported(l)) throw ApiException.badRequest("UNSUPPORTED_LOCALE", "Unsupported language: " + l);
    }
}
