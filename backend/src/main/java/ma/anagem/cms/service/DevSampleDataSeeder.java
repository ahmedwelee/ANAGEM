package ma.anagem.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.anagem.cms.common.ContentStatus;
import ma.anagem.cms.entity.*;
import ma.anagem.cms.repository.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * DEV ONLY (profile "dev"): loads the placeholder news/events/journal issue that appear in the design mock-up so the site is not empty.
 * None of this is real ANAGEM content; news items carry the tag "sample". Never active in production.
 */
@Slf4j
@Component
@Profile("dev")
@Order(100)
@RequiredArgsConstructor
public class DevSampleDataSeeder implements ApplicationRunner {
    private final ObjectMapper mapper;
    private final NewsRepository news;
    private final EventRepository events;
    private final PublicationRepository publications;
    private final CategoryRepository categories;
    private final UserRepository users;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        if (news.count() > 0) return;
        JsonNode root;
        try (InputStream in = new ClassPathResource("dev/sample-content.json").getInputStream()) { root = mapper.readTree(in); }
        User author = users.findAllByOrderByFullNameAsc().stream().findFirst().orElse(null);

        for (JsonNode n : root.path("news")) {
            News e = new News();
            e.setSlug(n.path("slug").asText());
            e.setStatus(ContentStatus.PUBLISHED);
            e.setPublishedAt(Instant.parse(n.path("publishedAt").asText()));
            e.setAuthor(author);
            categories.findByTypeAndSlug(CategoryType.NEWS, n.path("category").asText()).ifPresent(e::setCategory);
            n.path("tags").forEach(t -> e.getTags().add(t.asText()));
            for (Iterator<Map.Entry<String, JsonNode>> it = n.path("translations").fields(); it.hasNext(); ) {
                var t = it.next();
                NewsText x = new NewsText();
                x.setTitle(t.getValue().path("title").asText());
                x.setSummary(t.getValue().path("summary").asText(null));
                e.getTranslations().put(t.getKey(), x);
            }
            news.save(e);
        }
        for (JsonNode n : root.path("events")) {
            Event e = new Event();
            e.setSlug(n.path("slug").asText());
            e.setEventType(EventType.valueOf(n.path("type").asText()));
            e.setStartsAt(Instant.parse(n.path("startsAt").asText()));
            e.setEndsAt(Instant.parse(n.path("endsAt").asText()));
            e.setAllDay(n.path("allDay").asBoolean());
            e.setStatus(ContentStatus.PUBLISHED);
            e.setPublishedAt(Instant.parse("2026-09-01T00:00:00Z"));
            e.setAuthor(author);
            for (Iterator<Map.Entry<String, JsonNode>> it = n.path("translations").fields(); it.hasNext(); ) {
                var t = it.next();
                EventText x = new EventText();
                x.setTitle(t.getValue().path("title").asText());
                x.setDescription(t.getValue().path("description").asText(null));
                x.setLocation(t.getValue().path("location").asText(null));
                e.getTranslations().put(t.getKey(), x);
            }
            events.save(e);
        }
        for (JsonNode n : root.path("publications")) {
            Publication p = new Publication();
            p.setKind(PublicationKind.valueOf(n.path("kind").asText()));
            p.setPublicationYear(n.path("year").asInt());
            p.setIssueNumber(n.path("issue").asText(null));
            p.setFeatured(n.path("featured").asBoolean());
            p.setStatus(ContentStatus.PUBLISHED);
            p.setPublishedAt(Instant.parse(n.path("publishedAt").asText()));
            p.setAuthor(author);
            for (Iterator<Map.Entry<String, JsonNode>> it = n.path("translations").fields(); it.hasNext(); ) {
                var t = it.next();
                p.getTranslations().put(t.getKey(), new TitledText(t.getValue().path("title").asText(), t.getValue().path("description").asText(null)));
            }
            publications.save(p);
        }
        log.warn("Dev profile: loaded PLACEHOLDER sample news/events/journal issue (not real ANAGEM content).");
    }
}
