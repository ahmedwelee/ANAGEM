package ma.anagem.cms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = {"app.rate-limit.login-per-minute=3", "app.rate-limit.contact-per-minute=2"})
class RateLimitIntegrationTest extends IntegrationTestBase {

    @Test
    void loginAttemptsAreThrottledPerIp() throws Exception {
        String body = "{\"email\":\"nobody@test.local\",\"password\":\"whatever-pass\"}";
        for (int i = 0; i < 3; i++) mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "60")).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void contactFormIsThrottled() throws Exception {
        String body = "{\"name\":\"Rate\",\"email\":\"rate@example.org\",\"message\":\"Message de test assez long\"}";
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/public/contact").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated());
        mvc.perform(post("/api/public/contact").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isTooManyRequests());
    }
}
