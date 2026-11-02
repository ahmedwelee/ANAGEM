package ma.anagem.cms;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.nio.file.Files;
import org.springframework.boot.SpringApplication;

/**
 * The real backend for the end-to-end browser tests (e2e/): the production configuration (no "dev" profile, no sample content, API docs off)
 * on an embedded PostgreSQL that is thrown away when the process stops, so a test run needs no Docker and no database of its own.
 * Started by Playwright, or by hand: {@code ./mvnw spring-boot:test-run -Dspring-boot.run.main-class=ma.anagem.cms.E2eServer}.
 * Never shipped: it lives in the test sources.
 */
public final class E2eServer {
    public static final String ADMIN_EMAIL = "e2e-admin@anagem.test";
    public static final String ADMIN_PASSWORD = "E2e-Passw0rd-123!";

    private E2eServer() {}

    public static void main(String[] args) throws IOException {
        EmbeddedPostgres pg = EmbeddedPostgres.builder().start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> { try { pg.close(); } catch (IOException ignored) { } }));
        String port = System.getProperty("e2e.port", "28080");
        String site = System.getProperty("e2e.site", "http://localhost:24080");
        new SpringApplication(AnagemCmsApplication.class).run(
                "--server.port=" + port,
                "--spring.datasource.url=jdbc:postgresql://localhost:" + pg.getPort() + "/postgres",
                "--spring.datasource.username=postgres",
                "--spring.datasource.password=postgres",
                "--app.jwt.secret=e2e-secret-e2e-secret-e2e-secret-0123456789",
                "--app.bootstrap-admin.email=" + ADMIN_EMAIL,
                "--app.bootstrap-admin.password=" + ADMIN_PASSWORD,
                "--app.storage.root-dir=" + Files.createTempDirectory("anagem-e2e-storage"),
                "--app.public-base-url=" + site,
                "--app.cors.allowed-origins=" + site,
                "--app.rate-limit.login-per-minute=1000",
                "--app.rate-limit.contact-per-minute=1000");
    }
}
