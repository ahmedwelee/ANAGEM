package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.dto.SiteDtos.*;
import ma.anagem.cms.service.HomepageService;
import ma.anagem.cms.service.SettingsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminSiteController {
    private final HomepageService homepage;
    private final SettingsService settings;

    @GetMapping("/settings") @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    public List<SettingDto> settings() { return settings.adminAll(); }

    @PutMapping("/settings") @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    public List<SettingDto> updateSettings(@Valid @RequestBody UpdateSettingsRequest r) { return settings.update(r.settings()); }

    @GetMapping("/homepage/sections") @PreAuthorize("hasAuthority('HOMEPAGE_MANAGE')")
    public List<HomepageSectionDto> sections() { return homepage.adminList(); }

    @PutMapping("/homepage/sections/{key}") @PreAuthorize("hasAuthority('HOMEPAGE_MANAGE')")
    public HomepageSectionDto updateSection(@PathVariable String key, @Valid @RequestBody UpdateHomepageSectionRequest r) { return homepage.update(key, r); }
}
