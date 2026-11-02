package ma.anagem.cms.controller.pub;

import java.time.Duration;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.service.PageService;
import ma.anagem.cms.service.PageService.PageDto;
import ma.anagem.cms.service.SitemapService;
import ma.anagem.cms.service.SitemapService.SitemapDto;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicPageController {
    private final PageService pages;
    private final SitemapService sitemap;

    @GetMapping("/pages/{slug}")
    public PageDto page(@PathVariable String slug, Lang lang) { return pages.page(slug, lang); }

    @GetMapping("/sitemap")
    public ResponseEntity<SitemapDto> sitemap() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic()).body(sitemap.build());
    }
}
