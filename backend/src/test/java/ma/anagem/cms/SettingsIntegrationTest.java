package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SettingsIntegrationTest extends IntegrationTestBase {
    String root;

    @BeforeEach
    void token() throws Exception { root = tokenFor("SUPER_ADMIN"); }

    JsonNode all() throws Exception { return api(get("/api/admin/settings"), root, null, 200); }

    JsonNode valueOf(String key) throws Exception {
        for (JsonNode s : all()) if (s.path("key").asText().equals(key)) return s.path("value");
        throw new AssertionError("no setting " + key);
    }

    JsonNode change(Map<String, Object> changes, int expected) throws Exception { return api(put("/api/admin/settings"), root, Map.of("settings", changes), expected); }

    /** Puts a setting back to what it was, including JSON null (Map.of would refuse the null). */
    void restore(String key, JsonNode before) throws Exception {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(key, json.convertValue(before, Object.class));
        change(m, 200);
    }

    String invalid(String key, Object value) throws Exception {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(key, value);
        JsonNode e = change(m, 400);
        assertThat(e.path("code").asText()).as(key).isEqualTo("INVALID_SETTING");
        return e.path("message").asText();
    }

    @Test
    void theSeededSettingsAreListedWithTheirVisibility() throws Exception {
        Map<String, Boolean> visibility = new LinkedHashMap<>();
        all().forEach(s -> visibility.put(s.path("key").asText(), s.path("isPublic").asBoolean()));
        assertThat(visibility).containsKeys("site.name", "contact.email", "locales.default", "locales.enabled", "maintenance.enabled", "events.timezone");
        assertThat(visibility.get("site.name")).isTrue();
        assertThat(valueOf("locales.default").asText()).isEqualTo("ar");
        assertThat(valueOf("events.timezone").asText()).isEqualTo("Africa/Casablanca");
    }

    @Test
    void switchesMustBeRealBooleans() throws Exception {
        assertThat(invalid("maintenance.enabled", "true")).contains("true or false");
        invalid("maintenance.enabled", 1);
        invalid("membership.applications_enabled", null);
    }

    @Test
    void enabledLanguagesMustBeSupportedAndKeepTheDefault() throws Exception {
        assertThat(invalid("locales.enabled", List.of())).contains("non-empty");
        assertThat(invalid("locales.enabled", List.of("fr", "de"))).contains("unsupported language de");
        assertThat(invalid("locales.enabled", List.of("fr", "en"))).contains("default language"); // the default is Arabic
        assertThat(invalid("locales.enabled", "fr")).contains("non-empty list");
        assertThat(invalid("locales.default", "de")).contains("unsupported");
        JsonNode before = valueOf("locales.enabled");
        try {
            change(Map.of("locales.default", "fr", "locales.enabled", List.of("fr", "en")), 200); // both together: consistent
            assertThat(valueOf("locales.default").asText()).isEqualTo("fr");
            assertThat(invalid("locales.enabled", List.of("ar", "en"))).contains("default language");
        } finally {
            change(Map.of("locales.default", "ar", "locales.enabled", json.convertValue(before, List.class)), 200);
        }
        assertThat(valueOf("locales.default").asText()).isEqualTo("ar");
    }

    @Test
    void addressesAreCheckedAndMayBeCleared() throws Exception {
        assertThat(invalid("contact.email", "someone@")).contains("email");
        assertThat(invalid("social.facebook", "facebook.com/anagem")).contains("http(s) URL");
        assertThat(invalid("social.x", "javascript:alert(1)")).contains("http(s) URL");
        assertThat(invalid("contact.map_url", "ftp://maps.example.org")).contains("http(s) URL");
        JsonNode before = valueOf("social.linkedin");
        try {
            change(Map.of("social.linkedin", "https://www.linkedin.com/company/anagem"), 200);
            assertThat(valueOf("social.linkedin").asText()).isEqualTo("https://www.linkedin.com/company/anagem");
            assertThat(api(get("/api/public/settings"), null, null, 200).path("social.linkedin").asText()).isEqualTo("https://www.linkedin.com/company/anagem");
            change(Map.of("social.linkedin", ""), 200); // an empty value hides the link
        } finally {
            restore("social.linkedin", before);
        }
    }

    @Test
    void mediaSettingsNeedAnIdAndPublishAReadyToUseUrl() throws Exception {
        assertThat(invalid("site.logo_media_id", "not-a-uuid")).contains("media id");
        JsonNode before = valueOf("site.logo_media_id");
        String id = uploadMedia(root, "logo.png", "image/png", MediaIntegrationTest.png(200, 80));
        try {
            change(Map.of("site.logo_media_id", id), 200);
            JsonNode pub = api(get("/api/public/settings"), null, null, 200);
            assertThat(pub.path("site.logo_media_id").asText()).isEqualTo(id);
            assertThat(pub.path("site.logo_url").asText()).isEqualTo("/api/public/media/" + id);
        } finally {
            restore("site.logo_media_id", before);
        }
    }

    @Test
    void timeZoneMustExist() throws Exception {
        assertThat(invalid("events.timezone", "Mars/Olympus")).contains("time zone");
        assertThat(invalid("events.timezone", "")).contains("time zone");
    }

    @Test
    void textSettingsRefuseMarkupAndHugeValues() throws Exception {
        assertThat(invalid("site.tagline", Map.of("fr", "<b>gras</b>"))).contains("HTML");
        assertThat(invalid("site.name", "<img src=x onerror=alert(1)>")).contains("HTML");
        assertThat(invalid("contact.address", "x".repeat(20_001))).contains("too large");
        assertThat(change(Map.of("does.not.exist", "x"), 400).path("code").asText()).isEqualTo("UNKNOWN_SETTING");
    }

    @Test
    void aFailedChangeLeavesEverythingElseUntouched() throws Exception {
        JsonNode before = valueOf("site.short_name");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("site.short_name", "CHANGED");
        m.put("contact.email", "broken@");
        change(m, 400);
        assertThat(valueOf("site.short_name")).isEqualTo(before);
    }

    @Test
    void changesAreAuditedAndNotVisibleToOtherRoles() throws Exception {
        JsonNode before = valueOf("seo.default_title");
        try {
            change(Map.of("seo.default_title", Map.of("fr", "Titre " + System.nanoTime())), 200);
            boolean logged = false;
            for (JsonNode l : api(get("/api/admin/audit-logs").param("action", "SETTINGS_CHANGE").param("size", "50"), root, null, 200).path("content")) {
                if (l.path("summary").asText().contains("seo.default_title")) logged = true;
            }
            assertThat(logged).isTrue();
        } finally {
            restore("seo.default_title", before);
        }
        api(get("/api/admin/settings"), tokenFor("ADMIN"), null, 403);
        api(get("/api/admin/settings"), null, null, 401);
    }
}
