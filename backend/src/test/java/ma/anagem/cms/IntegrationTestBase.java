package ma.anagem.cms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.UUID;
import ma.anagem.cms.entity.User;
import ma.anagem.cms.repository.RoleRepository;
import ma.anagem.cms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Boots the full app against a real (embedded) PostgreSQL with all Flyway migrations applied. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {
    static final EmbeddedPostgres PG;

    static {
        try {
            PG = EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        Runtime.getRuntime().addShutdownHook(new Thread(() -> { try { PG.close(); } catch (IOException ignored) { } }));
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:" + PG.getPort() + "/postgres");
    }

    public static final String PASSWORD = "Sup3r-Secret-Pass!";

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected UserRepository users;
    @Autowired protected RoleRepository roles;
    @Autowired protected PasswordEncoder encoder;

    /** Creates a user with the given role (unique email) and returns a valid bearer token. */
    protected String tokenFor(String role) throws Exception {
        String email = role.toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
        User u = new User();
        u.setEmail(email);
        u.setFullName("Test " + role);
        u.setRole(roles.findByName(role).orElseThrow());
        u.setPasswordHash(encoder.encode(PASSWORD));
        users.save(u);
        return login(email, PASSWORD).path("accessToken").asText();
    }

    protected JsonNode login(String email, String password) throws Exception {
        String body = json.writeValueAsString(Map.of("email", email, "password", password));
        String res = mvc.perform(MockMvcRequestBuilders.post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(res);
    }

    protected MockHttpServletRequestBuilder bearer(MockHttpServletRequestBuilder b, String token) {
        return b.header("Authorization", "Bearer " + token);
    }

    /** Sends a JSON request (anonymous when {@code token} is null), checks the status and returns the parsed body (null when empty). */
    protected JsonNode api(MockHttpServletRequestBuilder b, String token, Object body, int expected) throws Exception {
        if (body != null) b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (token != null) bearer(b, token);
        String res = mvc.perform(b).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().is(expected)).andReturn().getResponse().getContentAsString();
        return res.isBlank() ? null : json.readTree(res);
    }

    /** Uploads a file to the media library as {@code token} and returns the new media id. */
    protected String uploadMedia(String token, String name, String contentType, byte[] data) throws Exception {
        String res = mvc.perform(bearer(MockMvcRequestBuilders.multipart("/api/admin/media/upload")
                        .file(new org.springframework.mock.web.MockMultipartFile("file", name, contentType, data)), token))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).path("id").asText();
    }

    protected static String unique(String prefix) { return prefix + " " + UUID.randomUUID().toString().substring(0, 6); }
}
