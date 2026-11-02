package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The editorial workflow and CRUD paths shared by every content type: write, review, publish, lock, archive, restore, delete. */
class ContentLifecycleIntegrationTest extends IntegrationTestBase {
    String editor, admin;

    @BeforeEach
    void tokens() throws Exception { editor = tokenFor("EDITOR"); admin = tokenFor("ADMIN"); }

    record Kind(String admin, String publicPath, Function<String, Map<String, Object>> body, boolean bySlug, boolean hasPublishEndpoint) {}

    static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    static final List<Kind> KINDS = List.of(
            new Kind("news", "/api/public/news/", t -> map("translations", Map.of("fr", Map.of("title", t, "content", "<p>Texte</p>"))), true, true),
            new Kind("events", "/api/public/events/", t -> map("type", "SEMINAR", "startsAt", Instant.now().plus(20, ChronoUnit.DAYS).toString(), "translations", Map.of("fr", Map.of("title", t))), true, true),
            new Kind("publications", "/api/public/publications/", t -> map("kind", "BOOK", "year", 2030, "translations", Map.of("fr", Map.of("title", t))), false, true),
            new Kind("resources", "/api/public/resources/", t -> map("kind", "DOCUMENT", "externalUrl", "https://example.org/doc", "translations", Map.of("fr", Map.of("title", t))), false, false));

    String ref(Kind k, JsonNode item) { return k.bySlug() ? item.path("slug").asText() : item.path("id").asText(); }

    void setStatus(Kind k, long id, String token, String status, int expected) throws Exception {
        api(patch("/api/admin/" + k.admin() + "/" + id + "/status"), token, map("status", status), expected);
    }

    @Test
    void everyContentTypeFollowsTheSameEditorialWorkflow() throws Exception {
        for (Kind k : KINDS) {
            String title = unique("Cycle " + k.admin());
            String base = "/api/admin/" + k.admin();
            JsonNode draft = api(post(base), editor, k.body().apply(title), 201);
            long id = draft.path("id").asLong();
            String why = k.admin();
            assertThat(draft.path("status").asText()).as(why).isEqualTo("DRAFT");
            api(get(k.publicPath() + ref(k, draft)), null, null, 404);                       // drafts are private

            api(get(base + "/" + id), editor, null, 200);
            Map<String, Object> edited = k.body().apply(title + " modifié");
            JsonNode updated = api(put(base + "/" + id), editor, edited, 200);
            assertThat(updated.path("translations").path("fr").path("title").asText()).as(why).isEqualTo(title + " modifié");

            setStatus(k, id, editor, "PENDING_REVIEW", 200);                                  // writers may ask for a review
            setStatus(k, id, editor, "PUBLISHED", 403);                                       // but not publish, schedule or archive
            setStatus(k, id, editor, "ARCHIVED", 403);
            api(delete(base + "/" + id), editor, null, 403);

            setStatus(k, id, admin, "PUBLISHED", 200);
            api(get(k.publicPath() + ref(k, draft)), null, null, 200);                        // now public
            api(put(base + "/" + id), editor, edited, 403);                                   // live content is locked for editors
            setStatus(k, id, editor, "DRAFT", 403);
            api(put(base + "/" + id), admin, edited, 200);                                    // ...but not for administrators

            setStatus(k, id, admin, "ARCHIVED", 200);
            api(get(k.publicPath() + ref(k, draft)), null, null, 404);                        // archived content disappears
            setStatus(k, id, admin, "DRAFT", 200);                                            // and can be restored
            api(delete(base + "/" + id), admin, null, 204);
            api(get(base + "/" + id), admin, null, 404);
            api(delete(base + "/" + id), admin, null, 404);
            api(put(base + "/" + id), admin, edited, 404);
            setStatus(k, id, admin, "PUBLISHED", 404);
        }
    }

    @Test
    void thePublishShortcutIsForPublishersOnly() throws Exception {
        for (Kind k : KINDS) {
            if (!k.hasPublishEndpoint()) continue;
            long id = api(post("/api/admin/" + k.admin()), editor, k.body().apply(unique("Raccourci")), 201).path("id").asLong();
            api(patch("/api/admin/" + k.admin() + "/" + id + "/publish"), editor, null, 403);
            assertThat(api(patch("/api/admin/" + k.admin() + "/" + id + "/publish"), admin, null, 200).path("status").asText()).as(k.admin()).isEqualTo("PUBLISHED");
        }
    }

    @Test
    void anAnonymousVisitorCannotTouchTheAdminApiOfAnyContentType() throws Exception {
        for (Kind k : KINDS) {
            api(get("/api/admin/" + k.admin()), null, null, 401);
            api(post("/api/admin/" + k.admin()), null, k.body().apply("x"), 401);
            api(put("/api/admin/" + k.admin() + "/1"), null, k.body().apply("x"), 401);
            api(delete("/api/admin/" + k.admin() + "/1"), null, null, 401);
        }
    }

    @Test
    void nothingIsSavedWithoutATitleInAtLeastOneLanguage() throws Exception {
        for (Kind k : KINDS) {
            Map<String, Object> blank = k.body().apply("x");
            blank.put("translations", Map.of("fr", Map.of("title", " ")));
            assertThat(api(post("/api/admin/" + k.admin()), admin, blank, 400).path("code").asText()).as(k.admin()).isEqualTo("NO_TRANSLATION");

            long id = api(post("/api/admin/" + k.admin()), admin, k.body().apply(unique("Titré")), 201).path("id").asLong();
            assertThat(api(put("/api/admin/" + k.admin() + "/" + id), admin, blank, 400).path("code").asText()).as(k.admin() + " update").isEqualTo("NO_TRANSLATION");
        }
    }

    @Test
    void aLanguageThatHasTextNeedsATitleToo() throws Exception {
        Map<String, Object> body = map("translations", Map.of("fr", Map.of("title", "Titre"), "ar", Map.of("title", "", "content", "<p>نص بلا عنوان</p>")));
        assertThat(api(post("/api/admin/news"), admin, body, 400).path("code").asText()).isEqualTo("TITLE_REQUIRED");
    }

    @Test
    void unsupportedLanguagesAndMissingTranslationsAreRefused() throws Exception {
        for (Kind k : KINDS) {
            Map<String, Object> body = k.body().apply("x");
            body.put("translations", Map.of("de", Map.of("title", "Titel")));
            assertThat(api(post("/api/admin/" + k.admin()), admin, body, 400).path("code").asText()).as(k.admin()).isEqualTo("UNSUPPORTED_LOCALE");
            body.put("translations", Map.of());
            api(post("/api/admin/" + k.admin()), admin, body, 400);
        }
    }

    @Test
    void eventsCanBeFilteredInTheDashboardList() throws Exception {
        String tag = unique("Filtre");
        Instant now = Instant.now();
        long upcoming = api(post("/api/admin/events"), admin, map("type", "WORKSHOP", "startsAt", now.plus(3, ChronoUnit.DAYS).toString(), "translations", Map.of("fr", Map.of("title", tag + " à venir"))), 201).path("id").asLong();
        long past = api(post("/api/admin/events"), admin, map("type", "SEMINAR", "startsAt", now.minus(30, ChronoUnit.DAYS).toString(), "translations", Map.of("fr", Map.of("title", tag + " passé"))), 201).path("id").asLong();
        setStatus(KINDS.get(1), past, admin, "PUBLISHED", 200);

        assertThat(ids(api(get("/api/admin/events").param("q", tag), admin, null, 200))).containsExactlyInAnyOrder(upcoming, past);
        assertThat(ids(api(get("/api/admin/events").param("q", tag).param("scope", "UPCOMING"), admin, null, 200))).containsExactly(upcoming);
        assertThat(ids(api(get("/api/admin/events").param("q", tag).param("scope", "PAST"), admin, null, 200))).containsExactly(past);
        assertThat(ids(api(get("/api/admin/events").param("q", tag).param("type", "SEMINAR"), admin, null, 200))).containsExactly(past);
        assertThat(ids(api(get("/api/admin/events").param("q", tag).param("status", "PUBLISHED"), admin, null, 200))).containsExactly(past);
        assertThat(ids(api(get("/api/admin/events").param("q", tag).param("status", "DRAFT"), admin, null, 200))).containsExactly(upcoming);
        api(get("/api/admin/events").param("status", "NOT_A_STATUS"), admin, null, 400);
    }

    @Test
    void publicationsAndResourcesCanBeFilteredInTheDashboardList() throws Exception {
        String tag = unique("Filtre");
        long book = api(post("/api/admin/publications"), admin, map("kind", "BOOK", "year", 2027, "translations", Map.of("fr", Map.of("title", tag + " livre"))), 201).path("id").asLong();
        long report = api(post("/api/admin/publications"), admin, map("kind", "REPORT", "year", 2028, "translations", Map.of("fr", Map.of("title", tag + " rapport"))), 201).path("id").asLong();
        assertThat(ids(api(get("/api/admin/publications").param("q", tag), admin, null, 200))).containsExactlyInAnyOrder(book, report);
        assertThat(ids(api(get("/api/admin/publications").param("q", tag).param("kind", "REPORT"), admin, null, 200))).containsExactly(report);
        assertThat(ids(api(get("/api/admin/publications").param("q", tag).param("year", "2027"), admin, null, 200))).containsExactly(book);

        long map = api(post("/api/admin/resources"), admin, map("kind", "MAP", "externalUrl", "https://example.org/m", "translations", Map.of("fr", Map.of("title", tag + " carte"))), 201).path("id").asLong();
        long doc = api(post("/api/admin/resources"), admin, map("kind", "DOCUMENT", "externalUrl", "https://example.org/d", "translations", Map.of("fr", Map.of("title", tag + " document"))), 201).path("id").asLong();
        assertThat(ids(api(get("/api/admin/resources").param("q", tag), admin, null, 200))).containsExactlyInAnyOrder(map, doc);
        assertThat(ids(api(get("/api/admin/resources").param("q", tag).param("kind", "MAP"), admin, null, 200))).containsExactly(map);
        assertThat(ids(api(get("/api/admin/resources").param("q", tag).param("status", "PUBLISHED"), admin, null, 200))).isEmpty();
    }

    @Test
    void listsAreSortedPagedAndBounded() throws Exception {
        String tag = unique("Page");
        for (int i = 1; i <= 3; i++) api(post("/api/admin/news"), admin, map("translations", Map.of("fr", Map.of("title", tag + " n" + i))), 201);
        JsonNode page = api(get("/api/admin/news").param("q", tag).param("size", "2").param("page", "0"), admin, null, 200);
        assertThat(page.path("content")).hasSize(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(3);
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        assertThat(api(get("/api/admin/news").param("q", tag).param("size", "2").param("page", "1"), admin, null, 200).path("content")).hasSize(1);
        assertThat(api(get("/api/admin/news").param("q", tag).param("page", "9"), admin, null, 200).path("content")).isEmpty();
        // an absurd page size is capped instead of loading the whole table
        assertThat(api(get("/api/admin/news").param("q", tag).param("size", "100000"), admin, null, 200).path("size").asInt()).isLessThanOrEqualTo(200);
    }

    @Test
    void categoriesCanBeRenamedReorderedHiddenAndKeepTheirType() throws Exception {
        String name = unique("Rubrique");
        JsonNode c = api(post("/api/admin/categories"), admin, map("type", "NEWS", "translations", Map.of("fr", Map.of("name", name), "ar", Map.of("name", "عنوان " + name))), 201);
        long id = c.path("id").asLong();
        String slug = c.path("slug").asText();
        assertThat(c.path("usageCount").asLong()).isZero();

        JsonNode renamed = api(put("/api/admin/categories/" + id), admin, map("type", "NEWS", "sortOrder", 7, "translations", Map.of("fr", Map.of("name", name + " bis", "description", "Description"))), 200);
        assertThat(renamed.path("slug").asText()).isEqualTo(slug); // the address does not change on its own
        assertThat(renamed.path("sortOrder").asInt()).isEqualTo(7);
        assertThat(renamed.path("translations").has("ar")).isFalse(); // the request replaces the translations

        JsonNode reslugged = api(put("/api/admin/categories/" + id), admin, map("type", "NEWS", "slug", slug + "-new", "translations", Map.of("fr", Map.of("name", name))), 200);
        assertThat(reslugged.path("slug").asText()).isEqualTo(slug + "-new");

        assertThat(api(put("/api/admin/categories/" + id), admin, map("type", "EVENT", "translations", Map.of("fr", Map.of("name", name))), 400).path("code").asText()).isEqualTo("TYPE_IMMUTABLE");
        api(put("/api/admin/categories/999999"), admin, map("type", "NEWS", "translations", Map.of("fr", Map.of("name", name))), 404);

        JsonNode other = api(post("/api/admin/categories"), admin, map("type", "NEWS", "translations", Map.of("fr", Map.of("name", unique("Autre")))), 201);
        assertThat(api(put("/api/admin/categories/" + other.path("id").asLong()), admin, map("type", "NEWS", "slug", slug + "-new", "translations", Map.of("fr", Map.of("name", "x"))), 409).path("code").asText()).isEqualTo("SLUG_TAKEN");

        api(put("/api/admin/categories/" + id), admin, map("type", "NEWS", "active", false, "translations", Map.of("fr", Map.of("name", name))), 200);
        boolean visible = false;
        for (JsonNode p : api(get("/api/public/categories").param("type", "NEWS"), null, null, 200)) if (p.path("id").asLong() == id) visible = true;
        assertThat(visible).isFalse();
        boolean listed = false;
        for (JsonNode p : api(get("/api/admin/categories").param("type", "NEWS"), editor, null, 200)) if (p.path("id").asLong() == id) listed = true;
        assertThat(listed).as("writers still see inactive categories in the admin").isTrue();

        api(delete("/api/admin/categories/" + id), admin, null, 204);
        api(delete("/api/admin/categories/" + id), admin, null, 404);
    }

    @Test
    void categoryUsageIsCountedAndWritersCannotManageCategories() throws Exception {
        JsonNode c = api(post("/api/admin/categories"), admin, map("type", "RESOURCE", "translations", Map.of("fr", Map.of("name", unique("Ressources")))), 201);
        long id = c.path("id").asLong();
        api(post("/api/admin/resources"), admin, map("kind", "DOCUMENT", "externalUrl", "https://example.org/x", "categoryId", id, "translations", Map.of("fr", Map.of("title", unique("Lié")))), 201);
        for (JsonNode a : api(get("/api/admin/categories").param("type", "RESOURCE"), admin, null, 200)) if (a.path("id").asLong() == id) assertThat(a.path("usageCount").asLong()).isEqualTo(1);
        assertThat(api(delete("/api/admin/categories/" + id), admin, null, 409).path("code").asText()).isEqualTo("CATEGORY_IN_USE");
        api(put("/api/admin/categories/" + id), editor, map("type", "RESOURCE", "translations", Map.of("fr", Map.of("name", "x"))), 403);
        api(delete("/api/admin/categories/" + id), editor, null, 403);
        api(get("/api/admin/categories"), null, null, 401);
    }

    @Test
    void anItemCannotUseACategoryOfAnotherType() throws Exception {
        long eventCategory = api(post("/api/admin/categories"), admin, map("type", "EVENT", "translations", Map.of("fr", Map.of("name", unique("Colloques")))), 201).path("id").asLong();
        api(post("/api/admin/publications"), admin, map("kind", "BOOK", "year", 2030, "categoryId", eventCategory, "translations", Map.of("fr", Map.of("title", "x"))), 400);
        api(post("/api/admin/resources"), admin, map("kind", "DOCUMENT", "externalUrl", "https://example.org/x", "categoryId", eventCategory, "translations", Map.of("fr", Map.of("title", "x"))), 400);
        api(post("/api/admin/news"), admin, map("categoryId", 999999, "translations", Map.of("fr", Map.of("title", "x"))), 400);
    }

    @Test
    void anUploadedFileCannotBeDeletedWhileAPublicationUsesItUnlessForced() throws Exception {
        String pdf = uploadMedia(admin, "doc.pdf", "application/pdf", MediaIntegrationTest.pdf());
        long id = api(post("/api/admin/publications"), admin, map("kind", "BOOK", "year", 2030, "pdfFileId", pdf, "translations", Map.of("fr", Map.of("title", unique("Avec PDF")))), 201).path("id").asLong();
        api(delete("/api/admin/media/" + pdf), admin, null, 409);
        // removing the file from the publication frees it
        api(put("/api/admin/publications/" + id), admin, map("kind", "BOOK", "year", 2030, "translations", Map.of("fr", Map.of("title", unique("Sans PDF")))), 200);
        api(delete("/api/admin/media/" + pdf), admin, null, 204);
    }

    @Test
    void publicResourceDetailsAndDownloadsWorkOnlyForPublishedItems() throws Exception {
        String pdf = uploadMedia(admin, "guide.pdf", "application/pdf", MediaIntegrationTest.pdf());
        long id = api(post("/api/admin/resources"), admin, map("kind", "EDUCATIONAL", "fileId", pdf, "translations", Map.of("fr", Map.of("title", unique("Guide"), "description", "<p>Un guide</p>"))), 201).path("id").asLong();
        api(get("/api/public/resources/" + id), null, null, 404);
        setStatus(KINDS.get(3), id, admin, "PUBLISHED", 200);
        JsonNode card = api(get("/api/public/resources/" + id).param("lang", "fr"), null, null, 200);
        assertThat(card.path("downloadUrl").asText()).contains(pdf).endsWith("?download=true");
        assertThat(card.path("file").path("contentType").asText()).isEqualTo("application/pdf");
        assertThat(card.path("fallback").asBoolean()).isFalse();
        api(get("/api/public/resources/" + id).param("lang", "ar"), null, null, 200); // falls back to French, still served
        assertThat(api(get("/api/public/resources/" + id).param("lang", "ar"), null, null, 200).path("fallback").asBoolean()).isTrue();
        api(get("/api/public/resources/abc"), null, null, 400);
    }

    static List<Long> ids(JsonNode page) {
        List<Long> ids = new java.util.ArrayList<>();
        page.path("content").forEach(n -> ids.add(n.path("id").asLong()));
        return ids;
    }
}
