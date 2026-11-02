package ma.anagem.cms.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ma.anagem.cms.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {
    final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(new AppProperties(null, null, null, null, null, new AppProperties.RateLimit(3, 2)), mapper);
    }

    private MockHttpServletResponse send(String method, String uri, String ip) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, res, chain);
        if (res.getStatus() == 200) assertThat(chain.getRequest()).as("request passed on").isNotNull();
        else assertThat(chain.getRequest()).as("request blocked").isNull();
        return res;
    }

    @Test
    void loginIsLimitedPerAddressAndAnsweredWith429() throws Exception {
        for (int i = 0; i < 3; i++) assertThat(send("POST", "/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(200);
        MockHttpServletResponse blocked = send("POST", "/api/auth/login", "10.0.0.1");
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");
        JsonNode body = mapper.readTree(blocked.getContentAsString());
        assertThat(body.path("code").asText()).isEqualTo("RATE_LIMITED");
        assertThat(body.path("status").asInt()).isEqualTo(429);
        assertThat(body.path("path").asText()).isEqualTo("/api/auth/login");
    }

    @Test
    void anotherAddressHasItsOwnBudget() throws Exception {
        for (int i = 0; i < 3; i++) send("POST", "/api/auth/login", "10.0.0.1");
        assertThat(send("POST", "/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(429);
        assertThat(send("POST", "/api/auth/login", "10.0.0.2").getStatus()).isEqualTo(200);
    }

    @Test
    void theContactFormHasItsOwnLimitAndItsOwnCounter() throws Exception {
        assertThat(send("POST", "/api/public/contact", "10.0.0.1").getStatus()).isEqualTo(200);
        assertThat(send("POST", "/api/public/contact", "10.0.0.1").getStatus()).isEqualTo(200);
        assertThat(send("POST", "/api/public/contact", "10.0.0.1").getStatus()).isEqualTo(429);
        assertThat(send("POST", "/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(200); // login budget untouched
    }

    @Test
    void onlyPostsToTheSensitiveEndpointsAreCounted() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertThat(send("GET", "/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(200);
            assertThat(send("GET", "/api/public/news", "10.0.0.1").getStatus()).isEqualTo(200);
            assertThat(send("POST", "/api/admin/news", "10.0.0.1").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void evictionKeepsRecentHitsAndDoesNotFail() throws Exception {
        for (int i = 0; i < 3; i++) send("POST", "/api/auth/login", "10.0.0.1");
        filter.evict();
        assertThat(send("POST", "/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(429); // still inside the one-minute window
    }
}
