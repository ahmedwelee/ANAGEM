package ma.anagem.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.LocalizedJson;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.repository.HomepageSectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Static pages (About, Members, ...) are CMS sections whose key starts with PAGE_; they share the homepage editor in the admin. */
@Service
@RequiredArgsConstructor
public class PageService {
    public static final String PREFIX = "PAGE_";
    private static final Pattern SLUG = Pattern.compile("[a-z][a-z0-9-]{0,40}");
    private final HomepageSectionRepository repo;

    public record PageDto(String slug, JsonNode content, Instant updatedAt) {}

    @Transactional(readOnly = true)
    public PageDto page(String slug, Lang lang) {
        if (!SLUG.matcher(slug).matches()) throw ApiException.notFound("Page");
        var s = repo.findBySectionKey(PREFIX + slug.toUpperCase().replace('-', '_')).filter(x -> x.isEnabled()).orElseThrow(() -> ApiException.notFound("Page"));
        return new PageDto(slug, LocalizedJson.resolve(s.getContent(), lang), s.getUpdatedAt());
    }
}
