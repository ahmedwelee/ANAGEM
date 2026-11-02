package ma.anagem.cms.controller.pub;

import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.PartnerDtos.PartnerPublicDto;
import ma.anagem.cms.dto.ResourceDtos.ResourceCardDto;
import ma.anagem.cms.entity.ResourceKind;
import ma.anagem.cms.service.PartnerService;
import ma.anagem.cms.service.ResourceService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicResourceController {
    private final ResourceService resources;
    private final PartnerService partners;

    @GetMapping("/resources")
    public PageResponse<ResourceCardDto> list(Lang lang, @RequestParam(required = false) String q, @RequestParam(required = false) ResourceKind kind,
                                              @RequestParam(required = false) Long categoryId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) {
        return resources.publicList(lang, q, kind, categoryId, page, size);
    }

    @GetMapping("/resources/{id}")
    public ResourceCardDto detail(@PathVariable Long id, Lang lang) { return resources.detail(id, lang); }

    @GetMapping("/partners")
    public List<PartnerPublicDto> partners(Lang lang) { return partners.publicList(lang); }
}
