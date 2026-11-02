package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PartnerIntegrationTest extends IntegrationTestBase {
    String editor, admin;

    @BeforeEach
    void tokens() throws Exception { editor = tokenFor("EDITOR"); admin = tokenFor("ADMIN"); }

    Map<String, Object> partner(String name) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("websiteUrl", "https://partner.example.org");
        body.put("sortOrder", 5);
        body.put("active", true);
        body.put("translations", Map.of("fr", Map.of("name", name + " (FR)"), "ar", Map.of("name", name + " (AR)")));
        return body;
    }

    JsonNode publicPartner(long id, String lang) throws Exception {
        for (JsonNode p : api(get("/api/public/partners").param("lang", lang), null, null, 200)) if (p.path("id").asLong() == id) return p;
        return null;
    }

    @Test
    void onlyAdminsManagePartnersAndAnonymousVisitorsAreRefused() throws Exception {
        api(get("/api/admin/partners"), null, null, 401);
        api(get("/api/admin/partners"), editor, null, 403);
        api(post("/api/admin/partners"), editor, partner("Refusé"), 403);
        api(put("/api/admin/partners/1"), editor, partner("Refusé"), 403);
        api(delete("/api/admin/partners/1"), editor, null, 403);
        api(get("/api/admin/partners"), admin, null, 200);
    }

    @Test
    void partnersAreCreatedUpdatedAndDeleted() throws Exception {
        String name = unique("Université");
        JsonNode created = api(post("/api/admin/partners"), admin, partner(name), 201);
        long id = created.path("id").asLong();
        assertThat(created.path("name").asText()).isEqualTo(name);
        assertThat(created.path("websiteUrl").asText()).isEqualTo("https://partner.example.org");
        assertThat(created.path("translations").path("ar").path("name").asText()).isEqualTo(name + " (AR)");
        assertThat(created.path("active").asBoolean()).isTrue();

        Map<String, Object> changed = partner(name + " bis");
        changed.put("websiteUrl", null);
        changed.put("sortOrder", 1);
        JsonNode updated = api(put("/api/admin/partners/" + id), admin, changed, 200);
        assertThat(updated.path("name").asText()).isEqualTo(name + " bis");
        assertThat(updated.path("websiteUrl").isNull()).isTrue(); // null clears the link (a blank string is rejected, see invalidPartners...)
        assertThat(updated.path("sortOrder").asInt()).isEqualTo(1);

        boolean listed = false;
        for (JsonNode p : api(get("/api/admin/partners"), admin, null, 200)) if (p.path("id").asLong() == id) listed = true;
        assertThat(listed).isTrue();

        api(delete("/api/admin/partners/" + id), admin, null, 204);
        api(delete("/api/admin/partners/" + id), admin, null, 404);
        api(put("/api/admin/partners/" + id), admin, partner(name), 404);
        assertThat(publicPartner(id, "fr")).isNull();
    }

    @Test
    void publicListShowsOnlyActivePartnersInTheVisitorsLanguage() throws Exception {
        String name = unique("Ministère");
        long id = api(post("/api/admin/partners"), admin, partner(name), 201).path("id").asLong();
        assertThat(publicPartner(id, "ar").path("name").asText()).isEqualTo(name + " (AR)");
        assertThat(publicPartner(id, "fr").path("name").asText()).isEqualTo(name + " (FR)");
        assertThat(publicPartner(id, "en").path("name").asText()).isEqualTo(name + " (AR)"); // no English: Arabic first, then French

        Map<String, Object> hidden = partner(name);
        hidden.put("active", false);
        api(put("/api/admin/partners/" + id), admin, hidden, 200);
        assertThat(publicPartner(id, "fr")).isNull();
        boolean stillInAdmin = false;
        for (JsonNode p : api(get("/api/admin/partners"), admin, null, 200)) if (p.path("id").asLong() == id) stillInAdmin = !p.path("active").asBoolean();
        assertThat(stillInAdmin).isTrue();
    }

    @Test
    void aPartnerWithoutTranslationsShowsItsBaseName() throws Exception {
        String name = unique("Fondation");
        Map<String, Object> body = partner(name);
        body.remove("translations");
        long id = api(post("/api/admin/partners"), admin, body, 201).path("id").asLong();
        assertThat(publicPartner(id, "ar").path("name").asText()).isEqualTo(name);
    }

    @Test
    void partnersAreOrderedBySortOrder() throws Exception {
        Map<String, Object> second = partner(unique("Second"));
        second.put("sortOrder", 900);
        Map<String, Object> first = partner(unique("First"));
        first.put("sortOrder", 899);
        long secondId = api(post("/api/admin/partners"), admin, second, 201).path("id").asLong();
        long firstId = api(post("/api/admin/partners"), admin, first, 201).path("id").asLong();
        int posFirst = -1, posSecond = -1, i = 0;
        for (JsonNode p : api(get("/api/public/partners"), null, null, 200)) {
            if (p.path("id").asLong() == firstId) posFirst = i;
            if (p.path("id").asLong() == secondId) posSecond = i;
            i++;
        }
        assertThat(posFirst).isGreaterThanOrEqualTo(0).isLessThan(posSecond);
    }

    @Test
    void invalidPartnersAreRefusedWithUsefulMessages() throws Exception {
        Map<String, Object> noName = partner("x");
        noName.put("name", " ");
        assertThat(api(post("/api/admin/partners"), admin, noName, 400).path("fieldErrors").toString()).contains("name");

        Map<String, Object> badUrl = partner(unique("Lien"));
        badUrl.put("websiteUrl", "javascript:alert(1)");
        assertThat(api(post("/api/admin/partners"), admin, badUrl, 400).path("fieldErrors").toString()).contains("websiteUrl");
        badUrl.put("websiteUrl", "  ");
        api(post("/api/admin/partners"), admin, badUrl, 400);

        Map<String, Object> badLocale = partner(unique("Langue"));
        badLocale.put("translations", Map.of("de", Map.of("name", "Partner")));
        assertThat(api(post("/api/admin/partners"), admin, badLocale, 400).path("code").asText()).isEqualTo("UNSUPPORTED_LOCALE");
    }

    @Test
    void theLogoMustBeAnUploadedImage() throws Exception {
        String logo = uploadMedia(admin, "logo.png", "image/png", MediaIntegrationTest.png(120, 60));
        String pdf = uploadMedia(admin, "doc.pdf", "application/pdf", MediaIntegrationTest.pdf());

        Map<String, Object> body = partner(unique("Logo"));
        body.put("logoId", logo);
        JsonNode created = api(post("/api/admin/partners"), admin, body, 201);
        assertThat(created.path("logo").path("id").asText()).isEqualTo(logo);
        assertThat(publicPartner(created.path("id").asLong(), "fr").path("logo").path("url").asText()).contains(logo);

        body.put("logoId", pdf);
        api(post("/api/admin/partners"), admin, body, 400);
        body.put("logoId", java.util.UUID.randomUUID().toString());
        assertThat(api(post("/api/admin/partners"), admin, body, 400).path("code").asText()).isEqualTo("UNKNOWN_MEDIA");

        // removing the logo again
        body.remove("logoId");
        assertThat(api(put("/api/admin/partners/" + created.path("id").asLong()), admin, body, 200).path("logo").isNull()).isTrue();
    }
}
