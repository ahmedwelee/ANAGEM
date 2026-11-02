package ma.anagem.cms.service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.dto.UserDtos.*;
import ma.anagem.cms.entity.Permission;
import ma.anagem.cms.entity.Role;
import ma.anagem.cms.entity.User;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.UserMapper;
import ma.anagem.cms.repository.PermissionRepository;
import ma.anagem.cms.repository.RoleRepository;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    private final UserRepository users;
    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final PasswordEncoder encoder;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<UserDto> list() { return users.findAllByOrderByFullNameAsc().stream().map(UserMapper::toDto).toList(); }

    private Role role(String name) { return roles.findByName(name).orElseThrow(() -> ApiException.badRequest("UNKNOWN_ROLE", "Unknown role: " + name)); }

    private User get(Long id) { return users.findById(id).orElseThrow(() -> ApiException.notFound("User")); }

    @Transactional
    public UserDto create(CreateUserRequest r) {
        if (users.existsByEmailIgnoreCase(r.email().trim())) throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists");
        User u = new User();
        u.setEmail(r.email().trim().toLowerCase());
        u.setFullName(r.fullName().trim());
        u.setRole(role(r.roleName()));
        u.setPasswordHash(encoder.encode(r.password()));
        if (r.preferredLocale() != null) u.setPreferredLocale(r.preferredLocale());
        users.save(u);
        audit.log(AuditAction.USER_CHANGE, "USER", u.getId(), "Created " + u.getEmail() + " as " + u.getRole().getName());
        return UserMapper.toDto(u);
    }

    @Transactional
    public UserDto update(Long id, UpdateUserRequest r) {
        User u = get(id);
        boolean self = CurrentUser.require().id().equals(id);
        boolean losesSuperAdmin = SUPER_ADMIN.equals(u.getRole().getName())
                && ((r.roleName() != null && !SUPER_ADMIN.equals(r.roleName())) || Boolean.FALSE.equals(r.enabled()));
        if (losesSuperAdmin && users.countByRole_Name(SUPER_ADMIN) <= 1) throw ApiException.conflict("LAST_SUPER_ADMIN", "The last super administrator cannot be demoted or disabled");
        if (self && Boolean.FALSE.equals(r.enabled())) throw ApiException.badRequest("CANNOT_DISABLE_SELF", "You cannot disable your own account");
        if (r.fullName() != null && !r.fullName().isBlank()) u.setFullName(r.fullName().trim());
        if (r.roleName() != null && !r.roleName().equals(u.getRole().getName())) {
            if (self) throw ApiException.badRequest("CANNOT_CHANGE_OWN_ROLE", "You cannot change your own role");
            u.setRole(role(r.roleName()));
        }
        if (r.enabled() != null) u.setEnabled(r.enabled());
        if (r.preferredLocale() != null) u.setPreferredLocale(r.preferredLocale());
        audit.log(AuditAction.USER_CHANGE, "USER", id, "Updated " + u.getEmail() + " (role " + u.getRole().getName() + ", enabled=" + u.isEnabled() + ")");
        return UserMapper.toDto(u);
    }

    @Transactional
    public void resetPassword(Long id, ResetPasswordRequest r) {
        User u = get(id);
        u.setPasswordHash(encoder.encode(r.newPassword()));
        u.setFailedLoginAttempts(0);
        u.setLockedUntil(null);
        audit.log(AuditAction.PASSWORD_CHANGE, "USER", id, "Password reset for " + u.getEmail());
    }

    @Transactional
    public void delete(Long id) {
        User u = get(id);
        if (CurrentUser.require().id().equals(id)) throw ApiException.badRequest("CANNOT_DELETE_SELF", "You cannot delete your own account");
        if (SUPER_ADMIN.equals(u.getRole().getName()) && users.countByRole_Name(SUPER_ADMIN) <= 1) throw ApiException.conflict("LAST_SUPER_ADMIN", "The last super administrator cannot be deleted");
        users.delete(u);
        audit.log(AuditAction.USER_CHANGE, "USER", id, "Deleted " + u.getEmail());
    }

    // ----- roles -----
    @Transactional(readOnly = true)
    public List<RoleDto> listRoles() { return roles.findAll().stream().map(UserMapper::toDto).sorted(java.util.Comparator.comparing(RoleDto::id)).toList(); }

    @Transactional(readOnly = true)
    public List<PermissionDto> listPermissions() { return permissions.findAll().stream().map(p -> new PermissionDto(p.getCode(), p.getDescription())).sorted(java.util.Comparator.comparing(PermissionDto::code)).toList(); }

    @Transactional
    public RoleDto updateRolePermissions(Long roleId, UpdateRolePermissionsRequest r) {
        Role role = roles.findById(roleId).orElseThrow(() -> ApiException.notFound("Role"));
        if (SUPER_ADMIN.equals(role.getName())) throw ApiException.badRequest("SUPER_ADMIN_FIXED", "The SUPER_ADMIN role always has every permission");
        Set<Permission> found = permissions.findAllById(r.permissions()).stream().collect(Collectors.toSet());
        if (found.size() != r.permissions().size()) throw ApiException.badRequest("UNKNOWN_PERMISSION", "One or more permission codes are unknown");
        role.getPermissions().clear();
        role.getPermissions().addAll(found);
        audit.log(AuditAction.ROLE_CHANGE, "ROLE", roleId, role.getName() + " permissions set to " + r.permissions());
        return UserMapper.toDto(role);
    }
}
