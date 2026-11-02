package ma.anagem.cms.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import lombok.extern.slf4j.Slf4j;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.entity.User;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class JwtService {
    private final AppProperties.Jwt cfg;
    private SecretKey key;

    public JwtService(AppProperties props) { this.cfg = props.jwt(); }

    @PostConstruct
    void init() {
        byte[] secret = cfg.secret() == null ? new byte[0] : cfg.secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) must be set and at least 32 characters long");
        }
        key = Keys.hmacShaKeyFor(secret);
    }

    public record Issued(String token, Instant expiresAt) {}

    public Issued issue(User user) {
        Instant now = Instant.now(), exp = now.plus(cfg.accessTtl());
        String token = Jwts.builder().id(UUID.randomUUID().toString()).issuer(cfg.issuer())
                .subject(String.valueOf(user.getId())).claim("email", user.getEmail()).claim("role", user.getRole().getName())
                .issuedAt(Date.from(now)).expiration(Date.from(exp)).signWith(key).compact();
        return new Issued(token, exp);
    }

    /** Verified claims, or empty for any invalid/expired/forged token. */
    public Optional<Claims> parse(String token) {
        try {
            return Optional.of(Jwts.parser().verifyWith(key).requireIssuer(cfg.issuer()).build().parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Rejected JWT: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
