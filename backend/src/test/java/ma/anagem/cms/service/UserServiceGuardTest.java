package ma.anagem.cms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;
import ma.anagem.cms.dto.UserDtos.UpdateUserRequest;
import ma.anagem.cms.entity.Role;
import ma.anagem.cms.entity.User;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.repository.PermissionRepository;
import ma.anagem.cms.repository.RoleRepository;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.security.AppUserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** The rules that keep the association from locking itself out: they depend on how many super administrators exist, which the shared integration database cannot control. */
@ExtendWith(MockitoExtension.class)
class UserServiceGuardTest {
    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock PermissionRepository permissions;
    @Mock PasswordEncoder encoder;
    @Mock AuditService audit;
    UserService service;

    @BeforeEach
    void setUp() { service = new UserService(users, roles, permissions, encoder, audit); }

    @AfterEach
    void clearContext() { SecurityContextHolder.clearContext(); }

    private static Role role(String name) { Role r = new Role(); r.setName(name); return r; }

    private static User user(long id, String role) {
        User u = new User();
        u.setId(id);
        u.setEmail("user" + id + "@anagem.test");
        u.setFullName("User " + id);
        u.setRole(role(role));
        return u;
    }

    private void signInAs(long id) {
        var principal = new AppUserPrincipal(id, "me@anagem.test", "Me", "SUPER_ADMIN", Set.of("USER_MANAGE"), true, null);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @Test
    void theLastSuperAdministratorCannotBeDemoted() {
        signInAs(1);
        when(users.findById(2L)).thenReturn(Optional.of(user(2, "SUPER_ADMIN")));
        when(users.countByRole_Name("SUPER_ADMIN")).thenReturn(1L);
        assertThatThrownBy(() -> service.update(2L, new UpdateUserRequest(null, "ADMIN", null, null)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("LAST_SUPER_ADMIN");
    }

    @Test
    void theLastSuperAdministratorCannotBeDisabled() {
        signInAs(1);
        when(users.findById(2L)).thenReturn(Optional.of(user(2, "SUPER_ADMIN")));
        when(users.countByRole_Name("SUPER_ADMIN")).thenReturn(1L);
        assertThatThrownBy(() -> service.update(2L, new UpdateUserRequest(null, null, false, null)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("LAST_SUPER_ADMIN");
    }

    @Test
    void theLastSuperAdministratorCannotBeDeleted() {
        signInAs(1);
        when(users.findById(2L)).thenReturn(Optional.of(user(2, "SUPER_ADMIN")));
        when(users.countByRole_Name("SUPER_ADMIN")).thenReturn(1L);
        assertThatThrownBy(() -> service.delete(2L)).isInstanceOf(ApiException.class).extracting("code").isEqualTo("LAST_SUPER_ADMIN");
        verify(users, never()).delete(any());
    }

    @Test
    void withAnotherSuperAdministratorAroundTheseChangesAreAllowed() {
        signInAs(1);
        User target = user(2, "SUPER_ADMIN");
        when(users.findById(2L)).thenReturn(Optional.of(target));
        when(users.countByRole_Name("SUPER_ADMIN")).thenReturn(2L);
        when(roles.findByName("ADMIN")).thenReturn(Optional.of(role("ADMIN")));
        assertThat(service.update(2L, new UpdateUserRequest(null, "ADMIN", null, null)).role()).isEqualTo("ADMIN");

        User other = user(3, "SUPER_ADMIN");
        when(users.findById(3L)).thenReturn(Optional.of(other));
        service.delete(3L);
        verify(users).delete(other);
    }

    @Test
    void editorsAndAdminsAreNotProtectedByTheLastSuperAdminRule() {
        signInAs(1);
        User admin = user(4, "ADMIN");
        when(users.findById(4L)).thenReturn(Optional.of(admin));
        assertThat(service.update(4L, new UpdateUserRequest(null, null, false, null)).enabled()).isFalse();
        service.delete(4L);
        verify(users).delete(admin);
    }

    @Test
    void youCannotTouchYourOwnRoleStateOrAccount() {
        signInAs(5);
        when(users.findById(5L)).thenReturn(Optional.of(user(5, "ADMIN")));
        assertThatThrownBy(() -> service.update(5L, new UpdateUserRequest(null, null, false, null))).extracting("code").isEqualTo("CANNOT_DISABLE_SELF");
        assertThatThrownBy(() -> service.update(5L, new UpdateUserRequest(null, "EDITOR", null, null))).extracting("code").isEqualTo("CANNOT_CHANGE_OWN_ROLE");
        assertThatThrownBy(() -> service.delete(5L)).extracting("code").isEqualTo("CANNOT_DELETE_SELF");
    }

    @Test
    void renamingYourselfOrKeepingYourRoleIsFine() {
        signInAs(5);
        when(users.findById(5L)).thenReturn(Optional.of(user(5, "ADMIN")));
        var dto = service.update(5L, new UpdateUserRequest("  Nouveau Nom ", "ADMIN", true, "fr"));
        assertThat(dto.fullName()).isEqualTo("Nouveau Nom");
        assertThat(dto.preferredLocale()).isEqualTo("fr");
    }

    @Test
    void unknownUsersGiveNotFound() {
        signInAs(1);
        when(users.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(404L)).isInstanceOf(ApiException.class).extracting("code").isEqualTo("NOT_FOUND");
    }
}
