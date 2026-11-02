package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.io.UncheckedIOException;
import ma.anagem.cms.repository.EventRepository;
import ma.anagem.cms.repository.NewsRepository;
import ma.anagem.cms.repository.PublicationRepository;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.service.DevSampleDataSeeder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The developer profile on its own, empty database (a separate embedded PostgreSQL, so the placeholder content can never leak into the other tests):
 * it must start, load the placeholder content from the JSON file, stay idempotent and publish the API documentation.
 * Production (no "dev" profile) has none of this: see {@link ApiContractIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "dev"}) // dev last: its bootstrap admin and API docs win over the test defaults
class DevProfileIntegrationTest {
    static final EmbeddedPostgres OWN_PG;

    static {
        try {
            OWN_PG = EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        Runtime.getRuntime().addShutdownHook(new Thread(() -> { try { OWN_PG.close(); } catch (IOException ignored) { } }));
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:" + OWN_PG.getPort() + "/postgres");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired NewsRepository news;
    @Autowired EventRepository events;
    @Autowired PublicationRepository publications;
    @Autowired UserRepository users;
    @Autowired DevSampleDataSeeder seeder;

    @Test
    void placeholderContentIsLoadedAndClearlyMarkedAsSample() throws Exception {
        assertThat(news.count()).isEqualTo(3);
        assertThat(events.count()).isEqualTo(4); // the 3 placeholders + the real Kénitra meeting from the migration
        assertThat(publications.count()).isEqualTo(1);
        JsonNode list = json.readTree(mvc.perform(get("/api/public/news").param("lang", "fr")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(list.path("totalElements").asInt()).isEqualTo(3);
        for (JsonNode n : list.path("content")) assertThat(n.path("tags").toString()).as(n.path("slug").asText()).contains("sample");
    }

    @Test
    void sampleEventsAreServedAndTheRealColloqueIsStillThere() throws Exception {
        JsonNode events = json.readTree(mvc.perform(get("/api/public/events").param("scope", "ALL").param("size", "50")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        StringBuilder slugs = new StringBuilder();
        events.path("content").forEach(e -> slugs.append(e.path("slug").asText()).append(' '));
        assertThat(slugs.toString()).contains("sample-conseil-anagem-2026").contains("rencontre-nationale-des-geographes-marocains-2026");
    }

    @Test
    void theSeederRunsOnlyOnAnEmptySite() throws Exception {
        long before = news.count() + events.count() + publications.count();
        seeder.run(null);
        assertThat(news.count() + events.count() + publications.count()).isEqualTo(before);
    }

    @Test
    void theDevelopersAdminAccountExistsAndApiDocumentationIsPublished() throws Exception {
        assertThat(users.findByEmailIgnoreCase("admin@anagem.local")).isPresent();
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andExpect(jsonPath("$.info.title").exists())
                .andExpect(jsonPath("$.paths['/api/admin/news']").exists())
                .andExpect(jsonPath("$.paths['/api/public/homepage']").exists())
                .andExpect(jsonPath("$.paths['/api/auth/login']").exists());
    }
}
