package ma.anagem.cms.security;

import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {
    private CurrentUser() {}

    public static Optional<AppUserPrincipal> get() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AppUserPrincipal p ? Optional.of(p) : Optional.empty();
    }

    public static AppUserPrincipal require() { return get().orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("No user")); }

    public static boolean can(String permission) { return get().map(p -> p.has(permission)).orElse(false); }

    public static Optional<TokenDetails> token() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getDetails() instanceof TokenDetails t ? Optional.of(t) : Optional.empty();
    }
}
