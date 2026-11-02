package ma.anagem.cms.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String publicBaseUrl,
        Jwt jwt,
        Storage storage,
        Cors cors,
        BootstrapAdmin bootstrapAdmin,
        RateLimit rateLimit) {

    public record Jwt(String secret, Duration accessTtl, String issuer) {}

    public record Storage(String rootDir, DataSize maxImageSize, DataSize maxPdfSize) {}

    public record Cors(List<String> allowedOrigins) {}

    public record BootstrapAdmin(String email, String password, String fullName) {}

    public record RateLimit(int loginPerMinute, int contactPerMinute) {}
}
