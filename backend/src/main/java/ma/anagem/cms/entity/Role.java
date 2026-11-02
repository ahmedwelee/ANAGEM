package ma.anagem.cms.entity;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import lombok.*;

@Entity @Table(name = "roles") @Getter @Setter @NoArgsConstructor
public class Role {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true) private String name;
    private String description;
    @Column(name = "system_role", nullable = false) private boolean systemRole;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_id"), inverseJoinColumns = @JoinColumn(name = "permission_code"))
    private Set<Permission> permissions = new HashSet<>();
}
