package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.dto.UserDtos.*;
import ma.anagem.cms.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminUserController {
    private final UserService service;

    @GetMapping("/users") @PreAuthorize("hasAuthority('USER_MANAGE')")
    public List<UserDto> users() { return service.list(); }

    @PostMapping("/users") @PreAuthorize("hasAuthority('USER_MANAGE')") @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@Valid @RequestBody CreateUserRequest r) { return service.create(r); }

    @PutMapping("/users/{id}") @PreAuthorize("hasAuthority('USER_MANAGE')")
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest r) { return service.update(id, r); }

    @PostMapping("/users/{id}/reset-password") @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<Void> reset(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest r) { service.resetPassword(id, r); return ResponseEntity.noContent().build(); }

    @DeleteMapping("/users/{id}") @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) { service.delete(id); return ResponseEntity.noContent().build(); }

    @GetMapping("/roles") @PreAuthorize("hasAuthority('USER_MANAGE') or hasAuthority('ROLE_MANAGE')")
    public List<RoleDto> roles() { return service.listRoles(); }

    @GetMapping("/permissions") @PreAuthorize("hasAuthority('ROLE_MANAGE')")
    public List<PermissionDto> permissions() { return service.listPermissions(); }

    @PutMapping("/roles/{id}/permissions") @PreAuthorize("hasAuthority('ROLE_MANAGE')")
    public RoleDto updatePermissions(@PathVariable Long id, @Valid @RequestBody UpdateRolePermissionsRequest r) { return service.updateRolePermissions(id, r); }
}
