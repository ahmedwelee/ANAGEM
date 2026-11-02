package ma.anagem.cms.service;

import java.time.Duration;
import java.time.Instant;
import ma.anagem.cms.dto.UserDtos.*;
import ma.anagem.cms.entity.RevokedToken;
import ma.anagem.cms.entity.User;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.UserMapper;
import ma.anagem.cms.repository.RevokedTokenRepository;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.security.CurrentUser;
import ma.anagem.cms.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserRepository users;
    private final RevokedTokenRepository revoked;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final AuditService audit;
    private final String dummyHash;

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(UserRepository users, RevokedTokenRepository revoked, PasswordEncoder encoder, JwtService jwt, AuditService audit) {
        this.users = users; this.revoked = revoked; this.encoder = encoder; this.jwt = jwt; this.audit = audit;
        this.dummyHash = encoder.encode("not-a-real-password");
    }

    private ApiException invalid() { return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password"); }

    /** noRollbackFor: failed-attempt counters must persist even though the call ends with an exception. */
    @Transactional(noRollbackFor = ApiException.class)
    public LoginResponse login(LoginRequest req) {
        User u = users.findByEmailIgnoreCase(req.email().trim()).orElse(null);
        if (u == null) { // spend the same hashing time as for a real account
            encoder.matches(req.password(), dummyHash);
            audit.logIndependent(AuditAction.LOGIN_FAILED, null, req.email(), "Unknown account");
            throw invalid();
        }
        Instant now = Instant.now();
        if (!u.isEnabled() || (u.getLockedUntil() != null && u.getLockedUntil().isAfter(now))) {
            audit.logIndependent(AuditAction.LOGIN_FAILED, u.getId(), u.getEmail(), "Disabled or locked account");
            throw invalid();
        }
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            int attempts = u.getFailedLoginAttempts() + 1;
            if (attempts >= MAX_FAILED_ATTEMPTS) { u.setLockedUntil(now.plus(LOCK_DURATION)); attempts = 0; }
            u.setFailedLoginAttempts(attempts);
            audit.logIndependent(AuditAction.LOGIN_FAILED, u.getId(), u.getEmail(), "Wrong password");
            throw invalid();
        }
        u.setFailedLoginAttempts(0);
        u.setLockedUntil(null);
        u.setLastLoginAt(now);
        var issued = jwt.issue(u);
        audit.logIndependent(AuditAction.LOGIN, u.getId(), u.getEmail(), "Signed in");
        return new LoginResponse(issued.token(), "Bearer", issued.expiresAt(), UserMapper.toDto(u));
    }

    @Transactional
    public void logout() {
        CurrentUser.token().ifPresent(t -> revoked.save(new RevokedToken(t.jti(), t.expiresAt())));
        audit.log(AuditAction.LOGOUT, "USER", CurrentUser.require().id(), "Signed out");
    }

    @Transactional(readOnly = true)
    public UserDto me() { return UserMapper.toDto(users.findById(CurrentUser.require().id()).orElseThrow()); }

    @Transactional
    public void changePassword(ChangePasswordRequest req) {
        User u = users.findById(CurrentUser.require().id()).orElseThrow();
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw ApiException.badRequest("WRONG_PASSWORD", "Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(req.newPassword()));
        audit.log(AuditAction.PASSWORD_CHANGE, "USER", u.getId(), "Password changed");
        CurrentUser.token().ifPresent(t -> revoked.save(new RevokedToken(t.jti(), t.expiresAt()))); // force a fresh sign-in
    }

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void purgeExpiredRevocations() { revoked.deleteExpired(Instant.now()); }
}
