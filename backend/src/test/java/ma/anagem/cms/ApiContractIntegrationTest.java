package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

/** What clients can rely on regardless of the feature: error format, what is (not) exposed, headers and cross-origin rules. */
class ApiContractIntegrationTest extends IntegrationTestBase {

    private JsonNode errorOf(MvcResult r) throws Exception { return json.readTree(r.getResponse().getContentAsString()); }

    @Test
    void everyErrorHasTheSameShapeAndLeaksNothing() throws Exception {
        MvcResult notFound = mvc.perform(get("/api/public/news/this-article-does-not-exist")).andExpect(status().isNotFound()).andReturn();
        JsonNode e = errorOf(notFound);
        assertThat(e.fieldNames()).toIterable().contains("timestamp", "status", "code", "message", "path");
        assertThat(e.path("status").asInt()).isEqualTo(404);
        assertThat(e.path("path").asText()).isEqualTo("/api/public/news/this-article-does-not-exist");
        assertThat(notFound.getResponse().getContentType()).startsWith("application/json");
        assertThat(notFound.getResponse().getContentAsString()).doesNotContain("Exception").doesNotContain("at ma.anagem").doesNotContain("org.springframework");
    }

    @Test
    void malformedRequestsAreBadRequestsNotServerErrors() throws Exception {
        String admin = tokenFor("ADMIN");
        for (var req : new org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder[]{
                post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{ this is not json"),
                post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(""),
                get("/api/public/categories"),                                   // required parameter missing
                get("/api/public/categories").param("type", "NOT_A_TYPE"),       // enum that does not exist
                get("/api/public/news").param("page", "abc"),                    // number expected
                bearer(get("/api/admin/news/not-a-number"), admin)}) {
            MvcResult r = mvc.perform(req).andReturn();
            assertThat(r.getResponse().getStatus()).as(req.toString()).isEqualTo(400);
            assertThat(errorOf(r).path("code").asText()).isEqualTo("MALFORMED_REQUEST");
        }
    }

    @Test
    void validationErrorsListTheFieldsThatAreWrong() throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"nope\",\"password\":\"\"}")).andExpect(status().isBadRequest()).andReturn();
        JsonNode e = errorOf(r);
        assertThat(e.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(e.path("fieldErrors").toString()).contains("email").contains("password");
    }

    @Test
    void wrongMethodsAndContentTypesAreRefusedClearly() throws Exception {
        assertThat(errorOf(mvc.perform(delete("/api/public/news")).andExpect(status().isMethodNotAllowed()).andReturn()).path("code").asText()).isEqualTo("METHOD_NOT_ALLOWED");
        assertThat(errorOf(mvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("a=b")).andExpect(status().isUnsupportedMediaType()).andReturn()).path("code").asText()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
    }

    @Test
    void unknownPathsAreNeverServed() throws Exception {
        assertThat(errorOf(mvc.perform(get("/api/public/nothing-here")).andExpect(status().isNotFound()).andReturn()).path("code").asText()).isEqualTo("NOT_FOUND");
        mvc.perform(get("/api/nothing")).andExpect(status().isUnauthorized());                                  // closed by default for visitors
        mvc.perform(bearer(get("/api/nothing"), tokenFor("SUPER_ADMIN"))).andExpect(status().isForbidden());    // and for staff
        mvc.perform(get("/admin")).andExpect(status().isUnauthorized());
        mvc.perform(get("/")).andExpect(status().isUnauthorized());
    }

    @Test
    void operationalEndpointsExposeHealthAndNothingElse() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk());
        mvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
        for (String path : new String[]{"/actuator/env", "/actuator/beans", "/actuator/heapdump", "/actuator/configprops", "/actuator/mappings", "/actuator/loggers", "/actuator/metrics"}) {
            int status = mvc.perform(get(path)).andReturn().getResponse().getStatus();
            assertThat(status).as(path).isIn(401, 403, 404);
            int staff = mvc.perform(bearer(get(path), tokenFor("SUPER_ADMIN"))).andReturn().getResponse().getStatus();
            assertThat(staff).as(path + " even for staff").isIn(401, 403, 404);
        }
    }

    @Test
    void interactiveApiDocsAreOffUnlessExplicitlyEnabled() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
        mvc.perform(get("/swagger-ui.html")).andExpect(status().is(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(404), org.hamcrest.Matchers.is(302))));
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
    }

    @Test
    void responsesCarrySecurityHeaders() throws Exception {
        MvcResult r = mvc.perform(get("/api/public/settings")).andExpect(status().isOk()).andReturn();
        assertThat(r.getResponse().getHeader("Content-Security-Policy")).isEqualTo("default-src 'none'; frame-ancestors 'none'");
        assertThat(r.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(r.getResponse().getHeader("Set-Cookie")).as("the API never sets cookies").isNull();
    }

    @Test
    void crossOriginCallsAreAllowedOnlyFromTheConfiguredSite() throws Exception {
        mvc.perform(options("/api/auth/login").header(HttpHeaders.ORIGIN, "http://localhost:4200")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST").header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, org.hamcrest.Matchers.containsString("POST")));
        mvc.perform(options("/api/auth/login").header(HttpHeaders.ORIGIN, "https://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden());
        MvcResult actual = mvc.perform(get("/api/public/settings").header(HttpHeaders.ORIGIN, "https://evil.example")).andReturn();
        assertThat(actual.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isNull();
    }

    @Test
    void theAdminApiNeedsATokenEverywhere() throws Exception {
        for (String path : new String[]{"/api/admin/news", "/api/admin/events", "/api/admin/publications", "/api/admin/resources", "/api/admin/categories", "/api/admin/partners",
                "/api/admin/media/00000000-0000-0000-0000-000000000000", "/api/admin/users", "/api/admin/roles", "/api/admin/permissions", "/api/admin/settings", "/api/admin/homepage/sections",
                "/api/admin/dashboard/statistics", "/api/admin/dashboard/recent-activity", "/api/admin/audit-logs", "/api/admin/contact-messages", "/api/auth/me"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("Authorization", "Bearer forged.token.value")).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("Authorization", "Basic YWRtaW46YWRtaW4=")).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void oversizedUploadsAndEmptyUploadsAreRefusedCleanly() throws Exception {
        String editor = tokenFor("EDITOR");
        mvc.perform(bearer(multipart("/api/admin/media/upload").file(new MockMultipartFile("file", "empty.png", "image/png", new byte[0])), editor)).andExpect(status().is4xxClientError());
        mvc.perform(bearer(multipart("/api/admin/media/upload"), editor)).andExpect(status().isBadRequest());
        mvc.perform(bearer(post("/api/admin/media/upload").contentType(MediaType.APPLICATION_JSON).content("{}"), editor)).andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void publicDataIsServedToAnonymousVisitorsInArabicByDefault() throws Exception {
        for (String path : new String[]{"/api/public/homepage", "/api/public/settings", "/api/public/news", "/api/public/events", "/api/public/events/upcoming", "/api/public/publications",
                "/api/public/publications/years", "/api/public/resources", "/api/public/partners", "/api/public/sitemap", "/api/public/pages/about"}) {
            mvc.perform(get(path)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/public/pages/about")).andExpect(jsonPath("$.content.title").value("الجمعية"));                                                    // nothing asked: Arabic
        mvc.perform(get("/api/public/pages/about").header("Accept-Language", "fr-FR,fr;q=0.9")).andExpect(jsonPath("$.content.title").value("L'association"));   // browser language
        mvc.perform(get("/api/public/pages/about").param("lang", "en").header("Accept-Language", "fr")).andExpect(jsonPath("$.content.title").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is("L'association"), org.hamcrest.Matchers.is("الجمعية")))));
        mvc.perform(get("/api/public/pages/this-page-does-not-exist")).andExpect(status().isNotFound());
    }
}
