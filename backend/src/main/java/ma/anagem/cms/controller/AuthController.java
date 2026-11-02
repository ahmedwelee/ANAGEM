package ma.anagem.cms.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.dto.UserDtos.*;
import ma.anagem.cms.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService auth;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) { return auth.login(req); }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() { auth.logout(); return ResponseEntity.noContent().build(); }

    @GetMapping("/me")
    public UserDto me() { return auth.me(); }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req) { auth.changePassword(req); return ResponseEntity.noContent().build(); }
}
