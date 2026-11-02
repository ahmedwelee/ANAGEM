package ma.anagem.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.util.*;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.LocalizedJson;
import ma.anagem.cms.dto.SiteDtos.SettingDto;
import ma.anagem.cms.entity.WebsiteSetting;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.repository.WebsiteSettingRepository;
import ma.anagem.cms.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SettingsService {
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern URL = Pattern.compile("^https?://\\S+$");
    private static final Pattern UUID_RE = Pattern.compile("^[0-9a-fA-F-]{36}$");
    private final WebsiteSettingRepository repo;
    private final UserRepository users;
    private final AuditService audit;

    /** Public settings, localized. Keys ending in _media_id also get a ready-to-use *_url entry. */
    @Transactional(readOnly = true)
    public Map<String, JsonNode> publicSettings(Lang lang) {
        Map<String, JsonNode> out = new TreeMap<>();
        for (WebsiteSetting s : repo.findByPublicSettingTrue()) {
            JsonNode v = LocalizedJson.resolve(s.getValue(), lang);
            out.put(s.getKey(), v);
            if (s.getKey().endsWith("_media_id") && v != null && v.isTextual()) {
                out.put(s.getKey().replace("_media_id", "_url"), JsonNodeFactory.instance.textNode("/api/public/media/" + v.asText()));
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<SettingDto> adminAll() {
        return repo.findAll().stream().sorted(Comparator.comparing(WebsiteSetting::getKey))
                .map(s -> new SettingDto(s.getKey(), s.getValue(), s.isPublicSetting(), s.getUpdatedAt())).toList();
    }

    @Transactional
    public List<SettingDto> update(Map<String, JsonNode> changes) {
        Map<String, WebsiteSetting> existing = new HashMap<>();
        repo.findAllById(changes.keySet()).forEach(s -> existing.put(s.getKey(), s));
        for (var e : changes.entrySet()) {
            if (!existing.containsKey(e.getKey())) throw ApiException.badRequest("UNKNOWN_SETTING", "Unknown setting: " + e.getKey());
            validate(e.getKey(), e.getValue(), changes, existing);
        }
        var actor = users.getReferenceById(CurrentUser.require().id());
        changes.forEach((k, v) -> { WebsiteSetting s = existing.get(k); s.setValue(v == null ? JsonNodeFactory.instance.nullNode() : v); s.setUpdatedBy(actor); });
        audit.log(AuditAction.SETTINGS_CHANGE, "SETTINGS", null, "Changed " + new TreeSet<>(changes.keySet()));
        return adminAll();
    }

    private void validate(String key, JsonNode v, Map<String, JsonNode> all, Map<String, WebsiteSetting> existing) {
        boolean empty = v == null || v.isNull() || (v.isTextual() && v.asText().isBlank());
        switch (key) {
            case "maintenance.enabled", "membership.applications_enabled" -> { if (v == null || !v.isBoolean()) bad(key, "must be true or false"); }
            case "locales.enabled" -> {
                if (v == null || !v.isArray() || v.isEmpty()) bad(key, "must be a non-empty list of languages");
                v.forEach(l -> { if (!Lang.isSupported(l.asText())) bad(key, "unsupported language " + l.asText()); });
                // the default may be changed in the same request, otherwise it is the stored one (not necessarily among the changed keys)
                JsonNode def = all.containsKey("locales.default") ? all.get("locales.default") : repo.findById("locales.default").map(WebsiteSetting::getValue).orElse(null);
                boolean has = def == null;
                for (JsonNode l : v) if (def != null && l.asText().equals(def.asText())) has = true;
                if (!has) bad(key, "must include the default language");
            }
            case "locales.default" -> { if (v == null || !Lang.isSupported(v.asText())) bad(key, "unsupported language"); }
            case "contact.email" -> { if (!empty && !EMAIL.matcher(v.asText()).matches()) bad(key, "not a valid email address"); }
            case "contact.map_url", "social.linkedin", "social.facebook", "social.x", "social.youtube" -> { if (!empty && !URL.matcher(v.asText()).matches()) bad(key, "must be an http(s) URL"); }
            case "site.logo_media_id", "seo.og_image_media_id" -> { if (!empty && !UUID_RE.matcher(v.asText()).matches()) bad(key, "must be a media id"); }
            case "events.timezone" -> { try { java.time.ZoneId.of(v.asText()); } catch (RuntimeException e) { bad(key, "unknown time zone"); } }
            default -> { }
        }
        if (v != null && v.toString().length() > 20_000) bad(key, "value is too large");
        if (v != null && v.toString().matches("(?s).*<\\s*[a-zA-Z/!].*")) bad(key, "HTML is not allowed");
    }

    private static void bad(String key, String msg) { throw ApiException.badRequest("INVALID_SETTING", key + ": " + msg); }
}
