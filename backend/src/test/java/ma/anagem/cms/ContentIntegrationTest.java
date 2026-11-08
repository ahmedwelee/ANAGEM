package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

class ContentIntegrationTest extends IntegrationTestBase {
    String writer, admin;

    @BeforeEach
    void tokens() throws Exception { writer = tokenFor(WRITER); admin = tokenFor("ADMIN"); }

    JsonNode send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder b, String token, Object body, int expected) throws Exception {
        if (body != null) b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        String res = mvc.perform(bearer(b, token)).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return res.isBlank() ? null : json.readTree(res);
    }

    String uploadId(String name, String type, byte[] data) throws Exception {
        return json.readTree(mvc.perform(bearer(multipart("/api/admin/media/upload").file(new MockMultipartFile("file", name, type, data)), admin)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    void publish(String kind, long id) throws Exception { send(patch("/api/admin/" + kind + "/" + id + "/status"), admin, Map.of("status", "PUBLISHED"), 200); }

    @Test
    void categoriesAreManagedByAdminsAndProtectedWhileInUse() throws Exception {
        String name = "Colloques " + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> body = Map.of("type", "EVENT", "translations", Map.of("fr", Map.of("name", name), "ar", Map.of("name", "ندوات")));
        send(post("/api/admin/categories"), writer, body, 403);
        JsonNode c = send(post("/api/admin/categories"), admin, body, 201);
        long id = c.path("id").asLong();
        assertThat(c.path("slug").asText()).startsWith("colloques-");
        send(post("/api/admin/categories"), admin, Map.of("type", "EVENT", "slug", c.path("slug").asText(), "translations", Map.of("fr", Map.of("name", "dup"))), 409);
        mvc.perform(get("/api/public/categories").param("type", "EVENT").param("lang", "ar")).andExpect(jsonPath("$[?(@.id==" + id + ")].name").value("ندوات"));

        send(post("/api/admin/events"), admin, Map.of("type", "SEMINAR", "startsAt", Instant.now().plus(5, ChronoUnit.DAYS).toString(), "categoryId", id, "translations", Map.of("fr", Map.of("title", "Séminaire catégorisé"))), 201);
        send(delete("/api/admin/categories/" + id), admin, null, 409);
        send(post("/api/admin/news"), admin, Map.of("categoryId", id, "translations", Map.of("fr", Map.of("title", "Mauvaise catégorie"))), 400); // EVENT category on news
    }

    @Test
    void publicationsHaveFilesYearFilterAndDraftsStayPrivate() throws Exception {
        String pdf = uploadId("revue.pdf", "application/pdf", MediaIntegrationTest.pdf());
        String cover = uploadId("cover.png", "image/png", MediaIntegrationTest.png(300, 400));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kind", "MAGAZINE_ISSUE"); body.put("year", 2031); body.put("issueNumber", "99"); body.put("pdfFileId", pdf); body.put("coverImageId", cover);
        body.put("translations", Map.of("fr", Map.of("title", "Géographie du Maroc n°99", "description", "<p>Dossier</p>"), "en", Map.of("title", "Geography of Morocco no. 99")));
        JsonNode p = send(post("/api/admin/publications"), writer, body, 201);
        long id = p.path("id").asLong();

        mvc.perform(get("/api/public/publications/" + id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/public/publications").param("year", "2031")).andExpect(jsonPath("$.totalElements").value(0));
        send(patch("/api/admin/publications/" + id + "/status"), writer, Map.of("status", "PUBLISHED"), 403);
        publish("publications", id);

        mvc.perform(get("/api/public/publications").param("year", "2031").param("kind", "MAGAZINE_ISSUE").param("lang", "en"))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].title").value("Geography of Morocco no. 99"))
                .andExpect(jsonPath("$.content[0].pdfDownloadUrl").value(org.hamcrest.Matchers.endsWith("?download=true")));
        mvc.perform(get("/api/public/publications").param("q", "n°99")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/public/publications/years")).andExpect(jsonPath("$").value(org.hamcrest.Matchers.hasItem(2031)));
        // wrong kind of file / unknown file
        body.put("pdfFileId", cover);
        send(post("/api/admin/publications"), admin, body, 400);
        body.put("pdfFileId", UUID.randomUUID().toString());
        assertThat(send(post("/api/admin/publications"), admin, body, 400).path("code").asText()).isEqualTo("UNKNOWN_MEDIA");
        body.put("pdfFileId", pdf); body.put("year", 1800);
        send(post("/api/admin/publications"), admin, body, 400);
    }

    @Test
    void eventsAreUpcomingOrPastByDateAndValidated() throws Exception {
        String tag = UUID.randomUUID().toString().substring(0, 6);
        Instant now = Instant.now();
        JsonNode future = send(post("/api/admin/events"), admin, Map.of("type", "CONFERENCE", "startsAt", now.plus(10, ChronoUnit.DAYS).toString(), "endsAt", now.plus(11, ChronoUnit.DAYS).toString(),
                "registrationUrl", "https://example.org/register", "translations", Map.of("fr", Map.of("title", "Futur " + tag, "location", "Kénitra"), "ar", Map.of("title", "مستقبل " + tag))), 201);
        JsonNode past = send(post("/api/admin/events"), admin, Map.of("type", "WORKSHOP", "startsAt", now.minus(10, ChronoUnit.DAYS).toString(), "endsAt", now.minus(9, ChronoUnit.DAYS).toString(),
                "translations", Map.of("fr", Map.of("title", "Passé " + tag))), 201);
        assertThat(future.path("timeStatus").asText()).isEqualTo("UPCOMING");
        assertThat(past.path("timeStatus").asText()).isEqualTo("PAST");
        publish("events", future.path("id").asLong());
        publish("events", past.path("id").asLong());

        mvc.perform(get("/api/public/events").param("q", tag)).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].timeStatus").value("UPCOMING"));
        mvc.perform(get("/api/public/events").param("q", tag).param("scope", "PAST")).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].timeStatus").value("PAST"));
        mvc.perform(get("/api/public/events").param("q", tag).param("scope", "ALL")).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/public/events/" + future.path("slug").asText()).param("lang", "ar")).andExpect(jsonPath("$.title").value("مستقبل " + tag));
        mvc.perform(get("/api/public/events/" + future.path("id").asLong())).andExpect(status().isOk());
        mvc.perform(get("/api/public/events/upcoming")).andExpect(status().isOk());

        Map<String, Object> bad = new LinkedHashMap<>(Map.of("type", "OTHER", "startsAt", now.plus(2, ChronoUnit.DAYS).toString(), "endsAt", now.plus(1, ChronoUnit.DAYS).toString(), "translations", Map.of("fr", Map.of("title", "x"))));
        assertThat(send(post("/api/admin/events"), admin, bad, 400).path("code").asText()).isEqualTo("END_BEFORE_START");
        bad.put("endsAt", now.plus(3, ChronoUnit.DAYS).toString()); bad.put("registrationUrl", "javascript:alert(1)");
        assertThat(send(post("/api/admin/events"), admin, bad, 400).path("fieldErrors").toString()).contains("registrationUrl");
    }

    @Test
    void allDayEventsSpanWholeMoroccanDays() throws Exception {
        JsonNode e = send(post("/api/admin/events"), admin, Map.of("type", "STUDY_DAY", "allDay", true, "startsAt", "2036-12-12T15:30:00Z", "endsAt", "2036-12-13T08:00:00Z",
                "translations", Map.of("fr", Map.of("title", "Journées " + UUID.randomUUID().toString().substring(0, 6)))), 201);
        assertThat(Instant.parse(e.path("startsAt").asText())).isEqualTo(Instant.parse("2036-12-11T23:00:00Z")); // 12 Dec 00:00 in Africa/Casablanca (UTC+1)
        assertThat(Instant.parse(e.path("endsAt").asText())).isEqualTo(Instant.parse("2036-12-13T22:59:59Z"));  // end of 13 Dec
    }

    @Test
    void resourcesNeedAFileOrLinkBeforePublishing() throws Exception {
        String t = "Carte " + UUID.randomUUID().toString().substring(0, 6);
        JsonNode r = send(post("/api/admin/resources"), writer, Map.of("kind", "MAP", "translations", Map.of("fr", Map.of("title", t))), 201);
        long id = r.path("id").asLong();
        assertThat(send(patch("/api/admin/resources/" + id + "/status"), admin, Map.of("status", "PUBLISHED"), 400).path("code").asText()).isEqualTo("RESOURCE_EMPTY");
        send(put("/api/admin/resources/" + id), writer, Map.of("kind", "MAP", "externalUrl", "https://example.org/map.pdf", "translations", Map.of("fr", Map.of("title", t))), 200);
        publish("resources", id);
        mvc.perform(get("/api/public/resources").param("kind", "MAP").param("q", t)).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].externalUrl").value("https://example.org/map.pdf"));
    }
}
