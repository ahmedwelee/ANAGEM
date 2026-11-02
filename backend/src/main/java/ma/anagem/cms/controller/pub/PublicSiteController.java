package ma.anagem.cms.controller.pub;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.dto.SiteDtos.HomepageDto;
import ma.anagem.cms.service.HomepageService;
import ma.anagem.cms.service.SettingsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicSiteController {
    private final HomepageService homepage;
    private final SettingsService settings;

    @GetMapping("/homepage")
    public HomepageDto homepage(Lang lang) { return homepage.homepage(lang); }

    @GetMapping("/settings")
    public Map<String, JsonNode> settings(Lang lang) { return settings.publicSettings(lang); }
}
