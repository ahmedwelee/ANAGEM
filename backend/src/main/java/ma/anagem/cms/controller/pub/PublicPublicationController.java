package ma.anagem.cms.controller.pub;

import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.PublicationDtos.PublicationCardDto;
import ma.anagem.cms.entity.PublicationKind;
import ma.anagem.cms.service.PublicationService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/publications")
@RequiredArgsConstructor
public class PublicPublicationController {
    private final PublicationService service;

    @GetMapping
    public PageResponse<PublicationCardDto> list(Lang lang, @RequestParam(required = false) String q, @RequestParam(required = false) Integer year,
                                                 @RequestParam(required = false) Long categoryId, @RequestParam(required = false) PublicationKind kind,
                                                 @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) {
        return service.publicList(lang, q, year, categoryId, kind, null, page, size);
    }

    @GetMapping("/years")
    public List<Integer> years() { return service.publicYears(); }

    @GetMapping("/{id}")
    public PublicationCardDto detail(@PathVariable Long id, Lang lang) { return service.detail(id, lang); }
}
