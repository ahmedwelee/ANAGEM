package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class PublicPagesIntegrationTest extends IntegrationTestBase {

    @Test
    void aboutAndMembersPagesAreServedInEachLanguage() throws Exception {
        mvc.perform(get("/api/public/pages/about").param("lang", "fr")).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.title").value("L'association")).andExpect(jsonPath("$.content.objectives.length()").value(9));
        mvc.perform(get("/api/public/pages/about").param("lang", "ar")).andExpect(jsonPath("$.content.title").value("الجمعية"));
        mvc.perform(get("/api/public/pages/members").param("lang", "en")).andExpect(jsonPath("$.content.categories[0].name").value("Active members"));
        mvc.perform(get("/api/public/pages/nope")).andExpect(status().isNotFound());
        mvc.perform(get("/api/public/pages/..%2Fetc")).andExpect(status().is4xxClientError());
    }

    @Test
    void pageSectionsNeverLeakIntoTheHomepagePayload() throws Exception {
        JsonNode home = json.readTree(mvc.perform(get("/api/public/homepage")).andReturn().getResponse().getContentAsString());
        home.path("sections").fieldNames().forEachRemaining(k -> assertThat(k).doesNotStartWith("PAGE_"));
        assertThat(home.path("sections").has("HERO")).isTrue();
    }

    @Test
    void sitemapListsOnlyPublicContent() throws Exception {
        String admin = tokenFor("ADMIN");
        String title = "Sitemap " + UUID.randomUUID().toString().substring(0, 6);
        long draft = create(admin, title + " brouillon");
        long live = create(admin, title + " publie");
        mvc.perform(bearer(patch("/api/admin/news/" + live + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PUBLISHED\"}"), admin)).andExpect(status().isOk());
        String body = mvc.perform(get("/api/public/sitemap")).andExpect(status().isOk()).andExpect(header().exists("Cache-Control")).andReturn().getResponse().getContentAsString();
        JsonNode s = json.readTree(body);
        String all = s.path("news").toString();
        assertThat(all).contains("sitemap-").contains(slugOf(admin, live)).doesNotContain(slugOf(admin, draft));
        assertThat(s.path("events").toString()).contains("rencontre-nationale-des-geographes-marocains-2026");
    }

    private long create(String token, String title) throws Exception {
        String res = mvc.perform(bearer(post("/api/admin/news").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("translations", Map.of("fr", Map.of("title", title))))), token))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).path("id").asLong();
    }

    private String slugOf(String token, long id) throws Exception {
        return json.readTree(mvc.perform(bearer(get("/api/admin/news/" + id), token)).andReturn().getResponse().getContentAsString()).path("slug").asText();
    }
}
