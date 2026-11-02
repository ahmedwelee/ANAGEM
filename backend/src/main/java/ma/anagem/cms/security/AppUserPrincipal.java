package ma.anagem.cms.security;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import ma.anagem.cms.entity.Permission;
import ma.anagem.cms.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/** Authenticated admin user. Authorities = ROLE_<name> plus one authority per permission code. */
public record AppUserPrincipal(Long id, String email, String fullName, String roleName, Set<String> permissions,
                               boolean enabled, Instant lockedUntil) implements UserDetails {

    public static AppUserPrincipal from(User u) {
        Set<String> perms = new HashSet<>();
        for (Permission p : u.getRole().getPermissions()) perms.add(p.getCode());
        return new AppUserPrincipal(u.getId(), u.getEmail(), u.getFullName(), u.getRole().getName(), perms, u.isEnabled(), u.getLockedUntil());
    }

    public boolean has(String permission) { return permissions.contains(permission); }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        Set<GrantedAuthority> a = new HashSet<>();
        a.add(new SimpleGrantedAuthority("ROLE_" + roleName));
        permissions.forEach(p -> a.add(new SimpleGrantedAuthority(p)));
        return a;
    }
    @Override public String getPassword() { return null; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonLocked() { return lockedUntil == null || lockedUntil.isBefore(Instant.now()); }
    @Override public boolean isEnabled() { return enabled; }
}
