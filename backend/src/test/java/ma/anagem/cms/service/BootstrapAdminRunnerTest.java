package ma.anagem.cms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.entity.Role;
import ma.anagem.cms.entity.User;
import ma.anagem.cms.repository.RoleRepository;
import ma.anagem.cms.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class BootstrapAdminRunnerTest {
    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock PasswordEncoder encoder;

    @BeforeEach
    void stubs() {
        Role superAdmin = new Role();
        superAdmin.setName("SUPER_ADMIN");
        lenient().when(roles.findByName("SUPER_ADMIN")).thenReturn(Optional.of(superAdmin));
        lenient().when(encoder.encode(any())).thenAnswer(i -> "hash(" + i.getArgument(0) + ")");
    }

    private BootstrapAdminRunner runner(String email, String password) {
        var props = new AppProperties(null, null, null, null, new AppProperties.BootstrapAdmin(email, password, "Super administrateur"), null);
        return new BootstrapAdminRunner(props, users, roles, encoder);
    }

    @Test
    void doesNothingWhenAccountsAlreadyExist() {
        when(users.count()).thenReturn(1L);
        runner("root@anagem.test", "Str0ng-Passw0rd!").run(null);
        verify(users, never()).save(any());
    }

    @Test
    void doesNothingWithoutAConfiguredEmail() {
        when(users.count()).thenReturn(0L);
        runner("", "whatever-password").run(null);
        runner(null, "whatever-password").run(null);
        verify(users, never()).save(any());
    }

    @Test
    void createsTheFirstSuperAdminFromTheConfiguredCredentials() {
        when(users.count()).thenReturn(0L);
        runner("  Root@Anagem.TEST ", "Str0ng-Passw0rd!").run(null);
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().getEmail()).isEqualTo("root@anagem.test");
        assertThat(saved.getValue().getRole().getName()).isEqualTo("SUPER_ADMIN");
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("hash(Str0ng-Passw0rd!)");
        assertThat(saved.getValue().getFullName()).isEqualTo("Super administrateur");
        assertThat(saved.getValue().isEnabled()).isTrue();
    }

    @Test
    void generatesAReadablePasswordWhenNoneIsConfigured() {
        when(users.count()).thenReturn(0L);
        runner("root@anagem.test", "").run(null);
        ArgumentCaptor<String> plain = ArgumentCaptor.forClass(String.class);
        verify(encoder).encode(plain.capture());
        assertThat(plain.getValue()).hasSize(20).matches("[A-HJ-NP-Za-km-z2-9]+"); // no 0/O/1/l/I lookalikes
        verify(users).save(any(User.class));
    }

    @Test
    void generatedPasswordsDiffer() {
        when(users.count()).thenReturn(0L);
        runner("root@anagem.test", null).run(null);
        runner("root@anagem.test", null).run(null);
        ArgumentCaptor<String> plain = ArgumentCaptor.forClass(String.class);
        verify(encoder, org.mockito.Mockito.times(2)).encode(plain.capture());
        assertThat(plain.getAllValues().get(0)).isNotEqualTo(plain.getAllValues().get(1));
    }
}
