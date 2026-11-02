package ma.anagem.cms.controller.pub;

import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.dto.CategoryDtos.CategoryDto;
import ma.anagem.cms.entity.CategoryType;
import ma.anagem.cms.service.CategoryService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/categories")
@RequiredArgsConstructor
public class PublicCategoryController {
    private final CategoryService service;

    @GetMapping
    public List<CategoryDto> list(@RequestParam CategoryType type, Lang lang) { return service.publicList(type, lang); }
}
