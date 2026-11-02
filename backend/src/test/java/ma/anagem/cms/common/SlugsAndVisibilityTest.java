package ma.anagem.cms.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SlugsAndVisibilityTest {
    @Test
    void slugsDropAccentsAndPunctuation() {
        assertThat(Slugs.slugify("Rencontre nationale des géographes marocains — 2026")).isEqualTo("rencontre-nationale-des-geographes-marocains-2026");
        assertThat(Slugs.slugify("  À l'Écoute !!  ")).isEqualTo("a-l-ecoute");
    }

    @Test
    void arabicOnlyTitlesGetARandomButValidSlug() {
        String slug = Slugs.slugify("الملتقى الوطني");
        assertThat(slug).matches("item-[0-9a-f]{8}");
        assertThat(Slugs.slugify(null)).startsWith("item-");
        assertThat(Slugs.slugify("   ")).isNotEqualTo(slug);
    }

    @Test
    void longTitlesAreCutWithoutATrailingHyphen() {
        String slug = Slugs.slugify(("mot ").repeat(80));
        assertThat(slug.length()).isLessThanOrEqualTo(120);
        assertThat(slug).doesNotEndWith("-");
    }

    @Test
    void uniqueAddsTheFirstFreeSuffix() {
        Set<String> taken = Set.of("actualite", "actualite-2", "actualite-3");
        assertThat(Slugs.unique("actualite", taken::contains)).isEqualTo("actualite-4");
        assertThat(Slugs.unique("autre", taken::contains)).isEqualTo("autre");
    }

    @Test
    void onlyPublishedOrScheduledItemsWhoseDateHasPassedAreVisible() {
        Instant now = Instant.parse("2026-10-13T10:00:00Z");
        Instant past = now.minus(1, ChronoUnit.DAYS), future = now.plus(1, ChronoUnit.DAYS);
        assertThat(Visibility.isPublic(ContentStatus.PUBLISHED, past, now)).isTrue();
        assertThat(Visibility.isPublic(ContentStatus.SCHEDULED, past, now)).isTrue(); // scheduled items go live by date alone
        assertThat(Visibility.isPublic(ContentStatus.SCHEDULED, future, now)).isFalse();
        assertThat(Visibility.isPublic(ContentStatus.PUBLISHED, future, now)).isFalse();
        assertThat(Visibility.isPublic(ContentStatus.PUBLISHED, now, now)).isTrue();
        assertThat(Visibility.isPublic(ContentStatus.PUBLISHED, null, now)).isFalse();
        for (ContentStatus s : new ContentStatus[]{ContentStatus.DRAFT, ContentStatus.PENDING_REVIEW, ContentStatus.ARCHIVED}) {
            assertThat(Visibility.isPublic(s, past, now)).as(s.name()).isFalse();
        }
    }
}
