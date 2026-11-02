package ma.anagem.cms.service;

import java.security.SecureRandom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.entity.User;
import ma.anagem.cms.repository.RoleRepository;
import ma.anagem.cms.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the first SUPER_ADMIN when the database has no users. Credentials come from the environment, never from code. */
@Slf4j
@Component
@RequiredArgsConstructor
public class BootstrapAdminRunner implements ApplicationRunner {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private final AppProperties props;
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        var cfg = props.bootstrapAdmin();
        if (cfg.email() == null || cfg.email().isBlank()) {
            log.warn("No users exist and BOOTSTRAP_ADMIN_EMAIL is not set: nobody can sign in to the admin area yet.");
            return;
        }
        boolean generated = cfg.password() == null || cfg.password().isBlank();
        String password = generated ? randomPassword() : cfg.password();
        User u = new User();
        u.setEmail(cfg.email().trim().toLowerCase());
        u.setFullName(cfg.fullName());
        u.setRole(roles.findByName(UserService.SUPER_ADMIN).orElseThrow());
        u.setPasswordHash(encoder.encode(password));
        users.save(u);
        if (generated) log.warn("\n=====\nFirst super administrator created: {}\nGenerated password (shown once, change it after signing in): {}\n=====", u.getEmail(), password);
        else log.info("First super administrator created: {}", u.getEmail());
    }

    private static String randomPassword() {
        SecureRandom r = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 20; i++) sb.append(ALPHABET.charAt(r.nextInt(ALPHABET.length())));
        return sb.toString();
    }
}
