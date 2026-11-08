package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class UserManagementIntegrationTest extends IntegrationTestBase {
    static final String NEW_PASSWORD = "Another-Str0ng-Pass!";
    String root, admin;

    @BeforeEach
    void tokens() throws Exception { root = tokenFor("SUPER_ADMIN"); admin = tokenFor("ADMIN"); }

    String email() { return "new-" + UUID.randomUUID().toString().substring(0, 8) + "@test.local"; }

    Map<String, Object> newUser(String email, String role) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("email", email); m.put("fullName", "Nouveau Compte"); m.put("roleName", role); m.put("password", PASSWORD);
        return m;
    }

    JsonNode create(String email, String role) throws Exception { return api(post("/api/admin/users"), root, newUser(email, role), 201); }

    long idOf(String token) throws Exception { return api(get("/api/auth/me"), token, null, 200).path("id").asLong(); }

    @Test
    void onlySuperAdminsManageAccounts() throws Exception {
        api(get("/api/admin/users"), null, null, 401);
        api(get("/api/admin/users"), admin, null, 403);
        api(post("/api/admin/users"), admin, newUser(email(), "EDITOR"), 403);
        api(delete("/api/admin/users/1"), admin, null, 403);
        api(get("/api/admin/permissions"), admin, null, 403);
        assertThat(api(get("/api/admin/users"), root, null, 200).size()).isGreaterThan(0);
    }

    @Test
    void aNewAccountCanSignInWithItsRoleAndArabicByDefault() throws Exception {
        String mail = "Nouveau." + UUID.randomUUID().toString().substring(0, 6) + "@Test.Local";
        JsonNode created = create(mail, "EDITOR");
        assertThat(created.path("email").asText()).isEqualTo(mail.toLowerCase()); // stored in lower case
        assertThat(created.path("role").asText()).isEqualTo("EDITOR");
        assertThat(created.path("enabled").asBoolean()).isTrue();
        assertThat(created.path("preferredLocale").asText()).isEqualTo("ar");
        assertThat(created.path("permissions").toString()).contains("CONTENT_WRITE", "CONTENT_PUBLISH").doesNotContain("CONTENT_DELETE", "USER_MANAGE");

        JsonNode session = login(created.path("email").asText(), PASSWORD);
        assertThat(session.path("accessToken").asText()).isNotBlank();
        assertThat(session.path("user").path("role").asText()).isEqualTo("EDITOR");
    }

    @Test
    void preferredLanguageCanBeChosenAtCreationAndLaterChanged() throws Exception {
        Map<String, Object> body = newUser(email(), "EDITOR");
        body.put("preferredLocale", "fr");
        JsonNode created = api(post("/api/admin/users"), root, body, 201);
        assertThat(created.path("preferredLocale").asText()).isEqualTo("fr");
        JsonNode updated = api(put("/api/admin/users/" + created.path("id").asLong()), root, Map.of("preferredLocale", "en"), 200);
        assertThat(updated.path("preferredLocale").asText()).isEqualTo("en");
        assertThat(updated.path("fullName").asText()).isEqualTo("Nouveau Compte"); // untouched fields stay
    }

    @Test
    void invalidAccountsAreRefused() throws Exception {
        String mail = email();
        create(mail, "EDITOR");
        assertThat(api(post("/api/admin/users"), root, newUser(mail.toUpperCase(), "EDITOR"), 409).path("code").asText()).isEqualTo("EMAIL_TAKEN");

        Map<String, Object> weak = newUser(email(), "EDITOR");
        weak.put("password", "short");
        assertThat(api(post("/api/admin/users"), root, weak, 400).path("fieldErrors").toString()).contains("password");

        assertThat(api(post("/api/admin/users"), root, newUser(email(), "WIZARD"), 400).path("code").asText()).isEqualTo("UNKNOWN_ROLE");
        assertThat(api(post("/api/admin/users"), root, newUser("not-an-email", "EDITOR"), 400).path("fieldErrors").toString()).contains("email");

        Map<String, Object> badLocale = newUser(email(), "EDITOR");
        badLocale.put("preferredLocale", "de");
        api(post("/api/admin/users"), root, badLocale, 400);
    }

    @Test
    void changingARoleTakesEffectOnTheNextRequestOfTheSameToken() throws Exception {
        String mail = email();
        JsonNode u = create(mail, "EDITOR");
        String token = login(mail, PASSWORD).path("accessToken").asText();
        Map<String, Object> category = Map.of("type", "NEWS", "translations", Map.of("fr", Map.of("name", unique("Rubrique"))));
        api(post("/api/admin/categories"), token, category, 403);

        api(put("/api/admin/users/" + u.path("id").asLong()), root, Map.of("roleName", "ADMIN"), 200);
        api(post("/api/admin/categories"), token, category, 201);
    }

    @Test
    void aDisabledAccountIsCutOffImmediatelyAndCanBeEnabledAgain() throws Exception {
        String mail = email();
        JsonNode u = create(mail, "EDITOR");
        String token = login(mail, PASSWORD).path("accessToken").asText();
        api(get("/api/auth/me"), token, null, 200);

        api(put("/api/admin/users/" + u.path("id").asLong()), root, Map.of("enabled", false), 200);
        api(get("/api/auth/me"), token, null, 401);
        assertThat(login(mail, PASSWORD).path("code").asText()).isEqualTo("INVALID_CREDENTIALS");

        api(put("/api/admin/users/" + u.path("id").asLong()), root, Map.of("enabled", true), 200);
        assertThat(login(mail, PASSWORD).path("accessToken").asText()).isNotBlank();
    }

    @Test
    void resettingAPasswordReplacesItAndUnlocksTheAccount() throws Exception {
        String mail = email();
        JsonNode u = create(mail, "EDITOR");
        for (int i = 0; i < 5; i++) login(mail, "wrong-password-" + i);
        assertThat(login(mail, PASSWORD).path("code").asText()).isEqualTo("INVALID_CREDENTIALS"); // locked even with the right password

        api(post("/api/admin/users/" + u.path("id").asLong() + "/reset-password"), root, Map.of("newPassword", "short"), 400);
        api(post("/api/admin/users/" + u.path("id").asLong() + "/reset-password"), root, Map.of("newPassword", NEW_PASSWORD), 204);
        assertThat(login(mail, PASSWORD).path("accessToken").isMissingNode()).isTrue();
        assertThat(login(mail, NEW_PASSWORD).path("accessToken").asText()).isNotBlank();
        api(post("/api/admin/users/999999/reset-password"), root, Map.of("newPassword", NEW_PASSWORD), 404);
    }

    @Test
    void changingYourOwnPasswordNeedsTheCurrentOneAndEndsTheSession() throws Exception {
        String mail = email();
        create(mail, "EDITOR");
        String token = login(mail, PASSWORD).path("accessToken").asText();

        assertThat(api(post("/api/auth/change-password"), token, Map.of("currentPassword", "not-my-password", "newPassword", NEW_PASSWORD), 400).path("code").asText()).isEqualTo("WRONG_PASSWORD");
        api(post("/api/auth/change-password"), token, Map.of("currentPassword", PASSWORD, "newPassword", "short"), 400);
        api(post("/api/auth/change-password"), token, Map.of("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD), 204);

        api(get("/api/auth/me"), token, null, 401); // the old token is revoked: sign in again
        assertThat(login(mail, PASSWORD).path("accessToken").isMissingNode()).isTrue();
        assertThat(login(mail, NEW_PASSWORD).path("accessToken").asText()).isNotBlank();
    }

    @Test
    void deletedAccountsCannotSignInAndUnknownOnesGiveNotFound() throws Exception {
        String mail = email();
        JsonNode u = create(mail, "EDITOR");
        String token = login(mail, PASSWORD).path("accessToken").asText();
        api(delete("/api/admin/users/" + u.path("id").asLong()), root, null, 204);
        api(get("/api/auth/me"), token, null, 401);
        assertThat(login(mail, PASSWORD).path("code").asText()).isEqualTo("INVALID_CREDENTIALS");
        api(delete("/api/admin/users/" + u.path("id").asLong()), root, null, 404);
        api(put("/api/admin/users/999999"), root, Map.of("enabled", false), 404);
    }

    @Test
    void youCannotLockYourselfOut() throws Exception {
        long me = idOf(root);
        assertThat(api(put("/api/admin/users/" + me), root, Map.of("enabled", false), 400).path("code").asText()).isEqualTo("CANNOT_DISABLE_SELF");
        assertThat(api(put("/api/admin/users/" + me), root, Map.of("roleName", "EDITOR"), 400).path("code").asText()).isEqualTo("CANNOT_CHANGE_OWN_ROLE");
        assertThat(api(delete("/api/admin/users/" + me), root, null, 400).path("code").asText()).isEqualTo("CANNOT_DELETE_SELF");
        api(get("/api/auth/me"), root, null, 200);
    }

    @Test
    void rolesAndPermissionsAreListedForSuperAdmins() throws Exception {
        List<String> roleNames = new ArrayList<>();
        api(get("/api/admin/roles"), root, null, 200).forEach(r -> roleNames.add(r.path("name").asText()));
        assertThat(roleNames).contains("SUPER_ADMIN", "ADMIN", "EDITOR");
        api(get("/api/admin/roles"), admin, null, 403);

        List<String> codes = new ArrayList<>();
        api(get("/api/admin/permissions"), root, null, 200).forEach(p -> codes.add(p.path("code").asText()));
        assertThat(codes).contains("CONTENT_PUBLISH", "USER_MANAGE", "PARTNER_MANAGE").isSorted();
    }

    @Test
    void editorsPublishByDefaultAndTheDefaultsOfTheOtherRolesAreUnchanged() throws Exception {
        Map<String, List<String>> byRole = new LinkedHashMap<>();
        api(get("/api/admin/roles"), root, null, 200).forEach(r -> {
            List<String> codes = new ArrayList<>();
            r.path("permissions").forEach(p -> codes.add(p.asText()));
            byRole.put(r.path("name").asText(), codes);
        });
        assertThat(byRole.get("EDITOR")).containsExactlyInAnyOrder("DASHBOARD_VIEW", "CONTENT_WRITE", "CONTENT_PUBLISH", "MEDIA_UPLOAD");
        assertThat(byRole.get("ADMIN")).contains("CONTENT_WRITE", "CONTENT_PUBLISH", "CONTENT_DELETE", "PARTNER_MANAGE").doesNotContain("USER_MANAGE", "ROLE_MANAGE", "SETTINGS_MANAGE", "AUDIT_VIEW");
    }

    @Test
    void takingThePublishPermissionAwayPutsEditorsBackThroughReviewAtOnce() throws Exception {
        long editorRole = 0;
        List<String> original = new ArrayList<>();
        for (JsonNode r : api(get("/api/admin/roles"), root, null, 200)) {
            if (r.path("name").asText().equals("EDITOR")) { editorRole = r.path("id").asLong(); r.path("permissions").forEach(p -> original.add(p.asText())); }
        }
        String editor = tokenFor("EDITOR");
        Map<String, Object> body = Map.of("translations", Map.of("fr", Map.of("title", unique("Validation"))));
        long id = api(post("/api/admin/news"), editor, body, 201).path("id").asLong();
        try {
            List<String> withoutPublish = new ArrayList<>(original);
            withoutPublish.remove("CONTENT_PUBLISH");
            api(put("/api/admin/roles/" + editorRole + "/permissions"), root, Map.of("permissions", withoutPublish), 200);
            assertThat(api(patch("/api/admin/news/" + id + "/status"), editor, Map.of("status", "PUBLISHED"), 403).path("code").asText()).isEqualTo("PUBLISH_FORBIDDEN"); // same token, permission gone
            api(patch("/api/admin/news/" + id + "/status"), editor, Map.of("status", "PENDING_REVIEW"), 200);                      // the review path is back
        } finally {
            api(put("/api/admin/roles/" + editorRole + "/permissions"), root, Map.of("permissions", original), 200);
        }
        api(patch("/api/admin/news/" + id + "/status"), editor, Map.of("status", "PUBLISHED"), 200);                               // restored: publishes again
    }

    @Test
    void rolePermissionsCanBeAdjustedExceptForSuperAdmin() throws Exception {
        JsonNode roles = api(get("/api/admin/roles"), root, null, 200);
        long editorRole = 0, superRole = 0;
        List<String> original = new ArrayList<>();
        for (JsonNode r : roles) {
            if (r.path("name").asText().equals("EDITOR")) { editorRole = r.path("id").asLong(); r.path("permissions").forEach(p -> original.add(p.asText())); }
            if (r.path("name").asText().equals("SUPER_ADMIN")) superRole = r.path("id").asLong();
        }
        assertThat(api(put("/api/admin/roles/" + superRole + "/permissions"), root, Map.of("permissions", List.of("CONTENT_WRITE")), 400).path("code").asText()).isEqualTo("SUPER_ADMIN_FIXED");
        assertThat(api(put("/api/admin/roles/" + editorRole + "/permissions"), root, Map.of("permissions", List.of("NOT_A_PERMISSION")), 400).path("code").asText()).isEqualTo("UNKNOWN_PERMISSION");
        api(put("/api/admin/roles/999999/permissions"), root, Map.of("permissions", List.of()), 404);
        api(put("/api/admin/roles/" + editorRole + "/permissions"), admin, Map.of("permissions", List.of()), 403);

        String editor = tokenFor("EDITOR");
        api(get("/api/admin/partners"), editor, null, 403);
        try {
            List<String> widened = new ArrayList<>(original);
            widened.add("PARTNER_MANAGE");
            JsonNode updated = api(put("/api/admin/roles/" + editorRole + "/permissions"), root, Map.of("permissions", widened), 200);
            assertThat(updated.path("permissions").toString()).contains("PARTNER_MANAGE");
            api(get("/api/admin/partners"), editor, null, 200); // same token, new permission
        } finally {
            api(put("/api/admin/roles/" + editorRole + "/permissions"), root, Map.of("permissions", original), 200);
        }
        api(get("/api/admin/partners"), editor, null, 403);
    }

    @Test
    void accountChangesAreWrittenToTheAuditLog() throws Exception {
        String mail = email();
        create(mail, "EDITOR");
        boolean found = false;
        for (JsonNode l : api(get("/api/admin/audit-logs").param("action", "USER_CHANGE").param("size", "200"), root, null, 200).path("content")) {
            if (l.path("summary").asText().contains(mail)) found = true;
        }
        assertThat(found).isTrue();
    }
}
