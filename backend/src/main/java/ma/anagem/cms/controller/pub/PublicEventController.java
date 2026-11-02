package ma.anagem.cms.controller.pub;

import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.EventDtos.*;
import ma.anagem.cms.entity.EventType;
import ma.anagem.cms.service.EventService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/events")
@RequiredArgsConstructor
public class PublicEventController {
    private final EventService service;

    @GetMapping
    public PageResponse<EventCardDto> list(Lang lang, @RequestParam(defaultValue = "UPCOMING") Scope scope, @RequestParam(required = false) EventType type,
                                           @RequestParam(required = false) Long categoryId, @RequestParam(required = false) String q,
                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) {
        return service.publicList(lang, scope, type, categoryId, q, null, page, size);
    }

    @GetMapping("/upcoming")
    public List<EventCardDto> upcoming(Lang lang, @RequestParam(defaultValue = "4") int limit) { return service.upcoming(lang, limit); }

    @GetMapping("/{idOrSlug}")
    public EventCardDto detail(@PathVariable String idOrSlug, Lang lang) { return service.detail(idOrSlug, lang); }
}
