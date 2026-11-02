package ma.anagem.cms.controller.pub;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.dto.OpsDtos.ContactRequest;
import ma.anagem.cms.service.ContactService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/contact")
@RequiredArgsConstructor
public class PublicContactController {
    private final ContactService service;

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Boolean> submit(@Valid @RequestBody ContactRequest r, HttpServletRequest http) {
        service.submit(r, http);
        return Map.of("received", true);
    }
}
