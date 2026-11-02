package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class SiteIntegrationTest extends IntegrationTestBase {
    String editor, admin, root;

    @BeforeEach
    void tokens() throws Exception { editor = tokenFor("EDITOR"); admin = tokenFor("ADMIN"); root = tokenFor("SUPER_ADMIN"); }

    JsonNode call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder b, String token, Object body, int expected) throws Exception {
        if (body != null) b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (token != null) bearer(b, token);
        String res = mvc.perform(b).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return res.isBlank() ? null : json.readTree(res);
    }

    @Test
    void homepageIsServedLocalizedInOneCall() throws Exception {
        JsonNode ar = call(get("/api/public/homepage").param("lang", "ar"), null, null, 200);
        assertThat(ar.path("sections").path("HERO").path("title").asText()).contains("الجغرافيا");
        assertThat(ar.path("sections").path("QUICK_ACCESS").path("items")).hasSize(6);
        assertThat(ar.path("sections").path("THEMATIC_AREAS").path("items")).hasSize(4);
        assertThat(ar.path("featuredEvent").path("slug").asText()).isEqualTo("rencontre-nationale-des-geographes-marocains-2026");
        assertThat(ar.path("featuredEvent").path("title").asText()).isEqualTo("الملتقى الوطني للجغرافيين المغاربة");
        assertThat(ar.path("settings").path("contact.address").asText()).isEqualTo("الرباط، المغرب");

        JsonNode fr = call(get("/api/public/homepage").param("lang", "fr"), null, null, 200);
        assertThat(fr.path("sections").path("QUICK_ACCESS").path("items").get(0).path("title").asText()).isEqualTo("L'association");
        assertThat(fr.path("featuredEvent").path("location").asText()).contains("Kénitra");
        assertThat(fr.path("settings").path("site.short_name").asText()).isEqualTo("ANAGEM");
    }

    @Test
    void settingsAreValidatedAndOnlySuperAdminsMayChangeThem() throws Exception {
        call(put("/api/admin/settings"), admin, Map.of("settings", Map.of("contact.email", "a@b.org")), 403);
        call(put("/api/admin/settings"), root, Map.of("settings", Map.of("contact.email", "not-an-email")), 400);
        call(put("/api/admin/settings"), root, Map.of("settings", Map.of("does.not.exist", "x")), 400);
        call(put("/api/admin/settings"), root, Map.of("settings", Map.of("locales.default", "de")), 400);
        call(put("/api/admin/settings"), root, Map.of("settings", Map.of("maintenance.enabled", "yes")), 400);
        assertThat(call(put("/api/admin/settings"), root, Map.of("settings", Map.of("site.tagline", Map.of("fr", "<script>x</script>"))), 400).path("message").asText()).contains("HTML");
        call(put("/api/admin/settings"), root, Map.of("settings", Map.of("contact.email", "contact@example.org")), 200);
        assertThat(call(get("/api/public/settings"), null, null, 200).path("contact.email").asText()).isEqualTo("contact@example.org");
        call(put("/api/admin/settings"), root, Map.of("settings", Map.of("contact.email", "")), 200);
    }

    @Test
    void homepageSectionsAreEditableWithoutCodeButNeverWithHtml() throws Exception {
        JsonNode original = call(get("/api/admin/homepage/sections"), admin, null, 200);
        JsonNode hero = null;
        for (JsonNode s : original) if (s.path("key").asText().equals("HERO")) hero = s;
        assertThat(hero).isNotNull();
        try {
            Map<String, Object> edited = Map.of("content", Map.of("fr", Map.of("title", "Titre modifié par l'admin"), "common", Map.of("primaryUrl", "/association")));
            call(put("/api/admin/homepage/sections/HERO"), editor, edited, 403);
            call(put("/api/admin/homepage/sections/HERO"), admin, Map.of("content", Map.of("fr", Map.of("title", "<img src=x onerror=alert(1)>"))), 400);
            call(put("/api/admin/homepage/sections/HERO"), admin, edited, 200);
            assertThat(call(get("/api/public/homepage").param("lang", "en"), null, null, 200).path("sections").path("HERO").path("title").asText()).isEqualTo("Titre modifié par l'admin");
        } finally {
            call(put("/api/admin/homepage/sections/HERO"), admin, Map.of("content", hero.path("content")), 200);
        }
    }

    @Test
    void contactFormStoresMessagesAndIgnoresBots() throws Exception {
        String who = "Visiteur " + UUID.randomUUID().toString().substring(0, 6);
        call(post("/api/public/contact"), null, Map.of("name", who, "email", "visiteur@example.org", "subject", "Adhésion", "message", "Bonjour, comment adhérer ?", "locale", "fr"), 201);
        call(post("/api/public/contact"), null, Map.of("name", "Bot", "email", "bot@example.org", "message", "buy cheap stuff now", "website", "http://spam.example"), 201); // silently dropped
        call(post("/api/public/contact"), null, Map.of("name", "X", "email", "invalid", "message", "short"), 400);
        call(get("/api/admin/contact-messages"), editor, null, 403);
        JsonNode list = call(get("/api/admin/contact-messages").param("size", "100"), admin, null, 200);
        long mine = 0, bots = 0;
        for (JsonNode m : list.path("content")) { if (m.path("name").asText().equals(who)) mine++; if (m.path("name").asText().equals("Bot")) bots++; }
        assertThat(mine).isEqualTo(1);
        assertThat(bots).isZero();
        long id = 0;
        for (JsonNode m : list.path("content")) if (m.path("name").asText().equals(who)) id = m.path("id").asLong();
        assertThat(call(patch("/api/admin/contact-messages/" + id), admin, Map.of("status", "READ"), 200).path("status").asText()).isEqualTo("READ");
    }

    @Test
    void auditLogRecordsActionsAndIsRestricted() throws Exception {
        String t = "Audit " + UUID.randomUUID().toString().substring(0, 6);
        call(post("/api/admin/news"), admin, Map.of("translations", Map.of("fr", Map.of("title", t))), 201);
        call(get("/api/admin/audit-logs"), admin, null, 403);
        JsonNode logs = call(get("/api/admin/audit-logs").param("action", "CREATE").param("resourceType", "NEWS").param("size", "200"), root, null, 200);
        boolean found = false;
        for (JsonNode l : logs.path("content")) if (l.path("summary").asText().contains("Created news") && l.path("actorEmail").asText().startsWith("admin-")) found = true;
        assertThat(found).isTrue();
        assertThat(call(get("/api/admin/audit-logs").param("action", "LOGIN").param("size", "5"), root, null, 200).path("content")).isNotEmpty();
        for (JsonNode a : call(get("/api/admin/dashboard/recent-activity"), editor, null, 200)) assertThat(a.path("action").asText()).isNotIn("LOGIN", "LOGIN_FAILED", "USER_CHANGE");
    }

    @Test
    void dashboardShowsCountsAndTranslationGaps() throws Exception {
        long before = call(get("/api/admin/dashboard/statistics"), editor, null, 200).path("news").path("total").asLong();
        JsonNode n = call(post("/api/admin/news"), admin, Map.of("translations", Map.of("fr", Map.of("title", "Lacune " + UUID.randomUUID().toString().substring(0, 6)))), 201);
        call(patch("/api/admin/news/" + n.path("id").asLong() + "/status"), admin, Map.of("status", "PUBLISHED"), 200);
        JsonNode stats = call(get("/api/admin/dashboard/statistics"), editor, null, 200);
        assertThat(stats.path("news").path("total").asLong()).isEqualTo(before + 1);
        assertThat(stats.path("news").path("byStatus").path("PUBLISHED").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(stats.path("translationGaps").path("news").path("incomplete").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(stats.path("adminUsers").isNull()).isTrue();                                   // editors cannot see the admin count
        assertThat(call(get("/api/admin/dashboard/statistics"), root, null, 200).path("adminUsers").asLong()).isGreaterThan(0);
        assertThat(stats.path("events").path("past").asLong() + stats.path("events").path("upcoming").asLong()).isGreaterThanOrEqualTo(1);
    }
}
