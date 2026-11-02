package ma.anagem.cms.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.repository.RevokedTokenRepository;
import ma.anagem.cms.repository.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Reads "Authorization: Bearer", re-loads the user on every request so disabling an account or changing a role takes effect at once. */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserRepository users;
    private final RevokedTokenRepository revoked;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwt.parse(h.substring(7).trim()).ifPresent(c -> authenticate(c, req));
        }
        chain.doFilter(req, res);
    }

    private void authenticate(Claims c, HttpServletRequest req) {
        if (revoked.existsById(c.getId())) return;
        long userId;
        try { userId = Long.parseLong(c.getSubject()); } catch (NumberFormatException e) { return; }
        users.findById(userId).map(AppUserPrincipal::from)
                .filter(p -> p.isEnabled() && p.isAccountNonLocked())
                .ifPresent(p -> {
                    var auth = new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities());
                    auth.setDetails(new TokenDetails(c.getId(), c.getExpiration().toInstant()));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                });
    }
}
