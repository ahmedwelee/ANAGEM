package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class NewsIntegrationTest extends IntegrationTestBase {
    String editor, admin;

    @BeforeEach
    void tokens() throws Exception { editor = tokenFor("EDITOR"); admin = tokenFor("ADMIN"); }

    Map<String, Object> text(String title, String summary, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title); m.put("summary", summary); m.put("content", content);
        return m;
    }

    JsonNode createNews(String token, Map<String, Object> body, int expectedStatus) throws Exception {
        String res = mvc.perform(bearer(post("/api/admin/news").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)), token))
                .andExpect(status().is(expectedStatus)).andReturn().getResponse().getContentAsString();
        return json.readTree(res);
    }

    Map<String, Object> frOnly(String title) { return Map.of("translations", Map.of("fr", text(title, "Résumé", "<p>Contenu</p>"))); }

    void setStatus(String token, long id, String status, Instant at, int expected) throws Exception {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("status", status);
        if (at != null) b.put("publishedAt", at.toString());
        mvc.perform(bearer(patch("/api/admin/news/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(b)), token)).andExpect(status().is(expected));
    }

    @Test
    void draftIsHiddenUntilAnAdminPublishesIt() throws Exception {
        String title = "Colloque géographie " + UUID.randomUUID().toString().substring(0, 6);
        JsonNode n = createNews(editor, frOnly(title), 201);
        long id = n.path("id").asLong();
        String slug = n.path("slug").asText();
        assertThat(n.path("status").asText()).isEqualTo("DRAFT");
        assertThat(slug).startsWith("colloque-geographie-");

        mvc.perform(get("/api/public/news/" + slug)).andExpect(status().isNotFound());
        mvc.perform(get("/api/public/news").param("q", title)).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));

        setStatus(editor, id, "PUBLISHED", null, 403);          // editors cannot publish
        setStatus(editor, id, "PENDING_REVIEW", null, 200);     // but can submit for approval
        setStatus(admin, id, "PUBLISHED", null, 200);

        mvc.perform(get("/api/public/news/" + slug)).andExpect(status().isOk()).andExpect(jsonPath("$.title").value(title));
        mvc.perform(get("/api/public/news").param("q", title.toUpperCase())).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void missingTranslationsFallBackAndAreReportedToAdmins() throws Exception {
        String t = "Article bilingue " + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> body = Map.of("translations", Map.of("fr", text(t, "s", "<p>c</p>"), "ar", text("مقال بالعربية", "ملخص", "<p>محتوى</p>")));
        JsonNode n = createNews(admin, body, 201);
        long id = n.path("id").asLong();
        setStatus(admin, id, "PUBLISHED", null, 200);
        String slug = n.path("slug").asText();

        mvc.perform(get("/api/public/news/" + slug).param("lang", "ar")).andExpect(jsonPath("$.title").value("مقال بالعربية")).andExpect(jsonPath("$.fallback").value(false));
        // Arabic is the site's default language, so it is the first fallback for a missing translation (then French, then English)
        mvc.perform(get("/api/public/news/" + slug).param("lang", "en")).andExpect(jsonPath("$.title").value("مقال بالعربية")).andExpect(jsonPath("$.locale").value("ar")).andExpect(jsonPath("$.fallback").value(true));
        mvc.perform(get("/api/public/news/" + slug).param("lang", "fr")).andExpect(jsonPath("$.title").value(t)).andExpect(jsonPath("$.fallback").value(false));
        // nothing asked at all: the default language
        mvc.perform(get("/api/public/news/" + slug)).andExpect(jsonPath("$.locale").value("ar")).andExpect(jsonPath("$.fallback").value(false));
        mvc.perform(get("/api/public/news/" + slug).header("Accept-Language", "fr-FR,fr;q=0.9")).andExpect(jsonPath("$.locale").value("fr"));

        // an article without Arabic falls back to French
        String frOnly = "Article français " + UUID.randomUUID().toString().substring(0, 6);
        JsonNode f = createNews(admin, Map.of("translations", Map.of("fr", text(frOnly, "s", "<p>c</p>"))), 201);
        setStatus(admin, f.path("id").asLong(), "PUBLISHED", null, 200);
        mvc.perform(get("/api/public/news/" + f.path("slug").asText()).param("lang", "ar")).andExpect(jsonPath("$.title").value(frOnly)).andExpect(jsonPath("$.locale").value("fr")).andExpect(jsonPath("$.fallback").value(true));

        JsonNode adminView = json.readTree(mvc.perform(bearer(get("/api/admin/news/" + id), admin)).andReturn().getResponse().getContentAsString());
        Map<String, Boolean> complete = new LinkedHashMap<>();
        adminView.path("translationStatus").forEach(s -> complete.put(s.path("locale").asText(), s.path("complete").asBoolean()));
        assertThat(complete).containsEntry("fr", true).containsEntry("ar", true).containsEntry("en", false);
    }

    @Test
    void schedulingNeedsAFutureDateAndScheduledItemsStayHidden() throws Exception {
        long id = createNews(admin, frOnly("Programmé " + UUID.randomUUID().toString().substring(0, 6)), 201).path("id").asLong();
        setStatus(admin, id, "SCHEDULED", Instant.now().minus(1, ChronoUnit.DAYS), 400);
        setStatus(admin, id, "SCHEDULED", null, 400);
        setStatus(admin, id, "SCHEDULED", Instant.now().plus(2, ChronoUnit.DAYS), 200);
        String slug = json.readTree(mvc.perform(bearer(get("/api/admin/news/" + id), admin)).andReturn().getResponse().getContentAsString()).path("slug").asText();
        mvc.perform(get("/api/public/news/" + slug)).andExpect(status().isNotFound());
    }

    @Test
    void liveContentIsLockedForEditorsButNotForAdmins() throws Exception {
        long id = createNews(admin, frOnly("Verrouillé " + UUID.randomUUID().toString().substring(0, 6)), 201).path("id").asLong();
        setStatus(admin, id, "PUBLISHED", null, 200);
        String body = json.writeValueAsString(frOnly("Modifié"));
        mvc.perform(bearer(put("/api/admin/news/" + id).contentType(MediaType.APPLICATION_JSON).content(body), editor)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("PUBLISHED_CONTENT_LOCKED"));
        mvc.perform(bearer(delete("/api/admin/news/" + id), editor)).andExpect(status().isForbidden());
        mvc.perform(bearer(put("/api/admin/news/" + id).contentType(MediaType.APPLICATION_JSON).content(body), admin)).andExpect(status().isOk()).andExpect(jsonPath("$.translations.fr.title").value("Modifié"));
        mvc.perform(bearer(delete("/api/admin/news/" + id), admin)).andExpect(status().isNoContent());
    }

    @Test
    void richTextIsSanitizedOnTheServer() throws Exception {
        String evil = "<p dir=\"rtl\">ok</p><script>alert(1)</script><img src=\"x\" onerror=\"alert(1)\"><a href=\"javascript:alert(1)\">bad</a><a href=\"https://example.org\">good</a><iframe src=\"https://evil.example\"></iframe>";
        JsonNode n = createNews(editor, Map.of("translations", Map.of("fr", text("XSS " + UUID.randomUUID(), "s", evil))), 201);
        String stored = n.path("translations").path("fr").path("content").asText();
        assertThat(stored).contains("<p dir=\"rtl\">ok</p>").contains("https://example.org").contains("rel=\"noopener noreferrer\"")
                .doesNotContain("<script").doesNotContain("onerror").doesNotContain("javascript:").doesNotContain("<iframe");
    }

    @Test
    void invalidInputGivesUsefulErrors() throws Exception {
        createNews(editor, Map.of("translations", Map.of()), 400);
        JsonNode e1 = createNews(editor, Map.of("translations", Map.of("fr", text("", "résumé sans titre", null))), 400);
        assertThat(e1.path("code").asText()).isEqualTo("TITLE_REQUIRED");
        JsonNode e2 = createNews(editor, Map.of("translations", Map.of("de", text("Titel", null, null))), 400);
        assertThat(e2.path("code").asText()).isEqualTo("UNSUPPORTED_LOCALE");
        JsonNode e3 = createNews(editor, Map.of("slug", "Not A Slug!", "translations", Map.of("fr", text("Titre", null, null))), 400);
        assertThat(e3.path("fieldErrors").toString()).contains("slug");
    }

    @Test
    void publicCanReadButNeverWrite() throws Exception {
        mvc.perform(get("/api/public/news")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/news").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(frOnly("x")))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/public/news").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isMethodNotAllowed());
    }

    @Test
    void tagsFilterAndRelatedArticles() throws Exception {
        String tag = "tag" + UUID.randomUUID().toString().substring(0, 6);
        long a = createNews(admin, Map.of("tags", List.of(tag), "translations", Map.of("fr", text("Premier " + tag, "s", null))), 201).path("id").asLong();
        long b = createNews(admin, Map.of("tags", List.of(tag.toUpperCase()), "translations", Map.of("fr", text("Second " + tag, "s", null))), 201).path("id").asLong();
        setStatus(admin, a, "PUBLISHED", null, 200);
        setStatus(admin, b, "PUBLISHED", null, 200);
        mvc.perform(get("/api/public/news").param("tag", tag)).andExpect(jsonPath("$.totalElements").value(2));
        String slugA = json.readTree(mvc.perform(bearer(get("/api/admin/news/" + a), admin)).andReturn().getResponse().getContentAsString()).path("slug").asText();
        mvc.perform(get("/api/public/news/" + slugA + "/related")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(b));
    }
}
