package ma.anagem.cms.mapper;

import ma.anagem.cms.dto.UserDtos.RoleDto;
import ma.anagem.cms.dto.UserDtos.UserDto;
import ma.anagem.cms.entity.Permission;
import ma.anagem.cms.entity.Role;
import ma.anagem.cms.entity.User;

public final class UserMapper {
    private UserMapper() {}

    public static UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole().getName(),
                u.getRole().getPermissions().stream().map(Permission::getCode).sorted().toList(),
                u.isEnabled(), u.getPreferredLocale(), u.getLastLoginAt(), u.getCreatedAt());
    }

    public static RoleDto toDto(Role r) {
        return new RoleDto(r.getId(), r.getName(), r.getDescription(), r.isSystemRole(),
                r.getPermissions().stream().map(Permission::getCode).sorted().toList());
    }
}
