package ma.anagem.cms.controller.pub;

import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.NewsDtos.*;
import ma.anagem.cms.service.NewsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/news")
@RequiredArgsConstructor
public class PublicNewsController {
    private final NewsService service;

    @GetMapping
    public PageResponse<NewsCardDto> list(Lang lang, @RequestParam(required = false) String q, @RequestParam(required = false) String category,
                                          @RequestParam(required = false) String tag, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "9") int size) {
        return service.publicList(lang, q, category, tag, null, page, size);
    }

    @GetMapping("/featured")
    public List<NewsCardDto> featured(Lang lang, @RequestParam(defaultValue = "3") int limit) { return service.featured(lang, limit); }

    @GetMapping("/{slug}")
    public NewsDetailDto detail(@PathVariable String slug, Lang lang) { return service.detail(slug, lang); }

    @GetMapping("/{slug}/related")
    public List<NewsCardDto> related(@PathVariable String slug, Lang lang, @RequestParam(defaultValue = "3") int limit) { return service.related(slug, lang, limit); }
}
