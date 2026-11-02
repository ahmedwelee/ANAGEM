package ma.anagem.cms.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Set;

public final class UserDtos {
    private UserDtos() {}

    public record LoginRequest(@NotBlank @Email @Size(max = 255) String email, @NotBlank @Size(max = 128) String password) {}

    public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, UserDto user) {}

    public record UserDto(Long id, String email, String fullName, String role, List<String> permissions, boolean enabled,
                          String preferredLocale, Instant lastLoginAt, Instant createdAt) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 12, max = 128) String newPassword) {}

    public record CreateUserRequest(@NotBlank @Email @Size(max = 255) String email, @NotBlank @Size(max = 150) String fullName,
                                    @NotBlank String roleName, @NotBlank @Size(min = 12, max = 128) String password,
                                    @Pattern(regexp = "fr|ar|en") String preferredLocale) {}

    public record UpdateUserRequest(@Size(max = 150) String fullName, String roleName, Boolean enabled,
                                    @Pattern(regexp = "fr|ar|en") String preferredLocale) {}

    public record ResetPasswordRequest(@NotBlank @Size(min = 12, max = 128) String newPassword) {}

    public record RoleDto(Long id, String name, String description, boolean systemRole, List<String> permissions) {}

    public record UpdateRolePermissionsRequest(@NotNull Set<String> permissions) {}

    public record PermissionDto(String code, String description) {}
}
