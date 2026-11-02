package ma.anagem.cms.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.entity.Role;
import ma.anagem.cms.entity.User;
import org.junit.jupiter.api.Test;

class JwtServiceTest {
    static final String SECRET = "unit-test-secret-unit-test-secret-0123456789";

    private static JwtService service(String secret, Duration ttl, String issuer) {
        JwtService s = new JwtService(new AppProperties(null, new AppProperties.Jwt(secret, ttl, issuer), null, null, null, null));
        s.init();
        return s;
    }

    private static User user() {
        Role role = new Role();
        role.setName("ADMIN");
        User u = new User();
        u.setId(42L);
        u.setEmail("admin@anagem.test");
        u.setRole(role);
        return u;
    }

    @Test
    void aFreshTokenCarriesTheUserAndExpiresAfterTheConfiguredTime() {
        JwtService jwt = service(SECRET, Duration.ofMinutes(30), "anagem-test");
        var issued = jwt.issue(user());
        var claims = jwt.parse(issued.token()).orElseThrow();
        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("email", String.class)).isEqualTo("admin@anagem.test");
        assertThat(claims.get("role", String.class)).isEqualTo("ADMIN");
        assertThat(claims.getIssuer()).isEqualTo("anagem-test");
        assertThat(claims.getId()).isNotBlank();
        assertThat(Duration.between(claims.getIssuedAt().toInstant(), claims.getExpiration().toInstant())).isBetween(Duration.ofMinutes(29), Duration.ofMinutes(31));
        assertThat(issued.expiresAt()).isAfter(claims.getIssuedAt().toInstant());
    }

    @Test
    void everyTokenHasItsOwnId() {
        JwtService jwt = service(SECRET, Duration.ofMinutes(5), "anagem-test");
        assertThat(jwt.parse(jwt.issue(user()).token()).orElseThrow().getId()).isNotEqualTo(jwt.parse(jwt.issue(user()).token()).orElseThrow().getId());
    }

    @Test
    void anExpiredTokenIsRejected() {
        JwtService jwt = service(SECRET, Duration.ofSeconds(-30), "anagem-test");
        assertThat(jwt.parse(jwt.issue(user()).token())).isEmpty();
    }

    @Test
    void aTamperedTokenIsRejected() {
        JwtService jwt = service(SECRET, Duration.ofMinutes(5), "anagem-test");
        String token = jwt.issue(user()).token();
        String[] parts = token.split("\\.");
        char last = parts[2].charAt(parts[2].length() - 2);
        String forgedSignature = parts[2].substring(0, parts[2].length() - 2) + (last == 'A' ? 'B' : 'A') + parts[2].charAt(parts[2].length() - 1);
        assertThat(jwt.parse(parts[0] + "." + parts[1] + "." + forgedSignature)).isEmpty();
        // swap the payload for another role while keeping the old signature
        String payload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"sub\":\"1\",\"role\":\"SUPER_ADMIN\"}".getBytes(StandardCharsets.UTF_8));
        assertThat(jwt.parse(parts[0] + "." + payload + "." + parts[2])).isEmpty();
    }

    @Test
    void tokensSignedWithAnotherKeyOrIssuerAreRejected() {
        JwtService jwt = service(SECRET, Duration.ofMinutes(5), "anagem-test");
        JwtService otherKey = service("another-secret-another-secret-0123456789ab", Duration.ofMinutes(5), "anagem-test");
        JwtService otherIssuer = service(SECRET, Duration.ofMinutes(5), "someone-else");
        assertThat(jwt.parse(otherKey.issue(user()).token())).isEmpty();
        assertThat(jwt.parse(otherIssuer.issue(user()).token())).isEmpty();
    }

    @Test
    void unsignedTokensAndGarbageAreRejected() {
        JwtService jwt = service(SECRET, Duration.ofMinutes(5), "anagem-test");
        String unsigned = Jwts.builder().subject("1").issuer("anagem-test").expiration(new Date(System.currentTimeMillis() + 60_000)).compact();
        assertThat(jwt.parse(unsigned)).isEmpty();
        String wrongAlgorithm = Jwts.builder().subject("1").issuer("anagem-test").expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor("x".repeat(64).getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(jwt.parse(wrongAlgorithm)).isEmpty();
        assertThat(jwt.parse("not.a.jwt")).isEmpty();
        assertThat(jwt.parse("")).isEmpty();
        assertThat(jwt.parse(null)).isEmpty();
    }

    @Test
    void theApplicationRefusesToStartWithAWeakOrMissingSecret() {
        for (String weak : new String[]{null, "", "too-short", "x".repeat(31)}) {
            JwtService s = new JwtService(new AppProperties(null, new AppProperties.Jwt(weak, Duration.ofMinutes(5), "anagem-test"), null, null, null, null));
            assertThatThrownBy(s::init).isInstanceOf(IllegalStateException.class).hasMessageContaining("JWT_SECRET");
        }
    }
}
