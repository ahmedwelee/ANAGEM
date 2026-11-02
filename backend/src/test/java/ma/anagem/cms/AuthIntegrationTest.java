package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AuthIntegrationTest extends IntegrationTestBase {

    @Test
    void bootstrapAdminCanSignInAndReadProfile() throws Exception {
        var login = login("root@test.local", "Root-Passw0rd-123!");
        assertThat(login.path("tokenType").asText()).isEqualTo("Bearer");
        assertThat(login.path("user").path("role").asText()).isEqualTo("SUPER_ADMIN");
        assertThat(login.path("user").path("permissions")).hasSizeGreaterThan(10);
        mvc.perform(bearer(get("/api/auth/me"), login.path("accessToken").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("root@test.local"));
    }

    @Test
    void wrongPasswordAndUnknownEmailGiveTheSameError() throws Exception {
        String a = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("email", "root@test.local", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        String b = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("email", "nobody@test.local", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(a).path("code").asText()).isEqualTo("INVALID_CREDENTIALS").isEqualTo(json.readTree(b).path("code").asText());
    }

    @Test
    void accountIsLockedAfterRepeatedFailures() throws Exception {
        String token = tokenFor("EDITOR");
        String email = json.readTree(mvc.perform(bearer(get("/api/auth/me"), token)).andReturn().getResponse().getContentAsString()).path("email").asText();
        for (int i = 0; i < 5; i++) login(email, "bad-password-" + i);
        assertThat(login(email, PASSWORD).path("code").asText()).isEqualTo("INVALID_CREDENTIALS"); // correct password, but locked
    }

    @Test
    void adminEndpointsRejectAnonymousAndGarbageTokens() throws Exception {
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(bearer(get("/api/admin/users"), "not.a.jwt")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheToken() throws Exception {
        String token = tokenFor("ADMIN");
        mvc.perform(bearer(get("/api/auth/me"), token)).andExpect(status().isOk());
        mvc.perform(bearer(post("/api/auth/logout"), token)).andExpect(status().isNoContent());
        mvc.perform(bearer(get("/api/auth/me"), token)).andExpect(status().isUnauthorized());
    }

    @Test
    void rolesAreEnforcedOnTheBackend() throws Exception {
        String editor = tokenFor("EDITOR"), admin = tokenFor("ADMIN"), root = tokenFor("SUPER_ADMIN");
        mvc.perform(bearer(get("/api/admin/users"), editor)).andExpect(status().isForbidden());
        mvc.perform(bearer(get("/api/admin/users"), admin)).andExpect(status().isForbidden());
        mvc.perform(bearer(get("/api/admin/users"), root)).andExpect(status().isOk());
        mvc.perform(bearer(put("/api/admin/roles/2/permissions").contentType(MediaType.APPLICATION_JSON).content("{\"permissions\":[]}"), admin)).andExpect(status().isForbidden());
    }

    @Test
    void superAdminCanCreateUsersButNotWeakPasswords() throws Exception {
        String root = tokenFor("SUPER_ADMIN");
        String weak = json.writeValueAsString(Map.of("email", "weak@test.local", "fullName", "Weak", "roleName", "EDITOR", "password", "short"));
        mvc.perform(bearer(post("/api/admin/users").contentType(MediaType.APPLICATION_JSON).content(weak), root))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED")).andExpect(jsonPath("$.fieldErrors[0].field").value("password"));
        String ok = json.writeValueAsString(Map.of("email", "new-editor@test.local", "fullName", "New Editor", "roleName", "EDITOR", "password", "A-long-enough-pass-1"));
        mvc.perform(bearer(post("/api/admin/users").contentType(MediaType.APPLICATION_JSON).content(ok), root)).andExpect(status().isCreated());
        mvc.perform(bearer(post("/api/admin/users").contentType(MediaType.APPLICATION_JSON).content(ok), root)).andExpect(status().isConflict());
        assertThat(login("new-editor@test.local", "A-long-enough-pass-1").path("user").path("role").asText()).isEqualTo("EDITOR");
    }
}
