package ma.anagem.cms.controller.admin;

import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.dto.MediaDtos.*;
import ma.anagem.cms.entity.MediaKind;
import ma.anagem.cms.service.MediaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/media")
@RequiredArgsConstructor
public class AdminMediaController {
    private final MediaService service;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('MEDIA_UPLOAD')") @ResponseStatus(HttpStatus.CREATED)
    public MediaDto upload(@RequestPart("file") MultipartFile file) { return service.upload(file); }

    @GetMapping @PreAuthorize("hasAuthority('MEDIA_UPLOAD') or hasAuthority('CONTENT_WRITE')")
    public PageResponse<MediaDto> list(@RequestParam(required = false) String q, @RequestParam(required = false) MediaKind kind,
                                       @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size) {
        return service.list(q, kind, page, size);
    }

    @GetMapping("/{id}") @PreAuthorize("hasAuthority('MEDIA_UPLOAD') or hasAuthority('CONTENT_WRITE')")
    public MediaDto get(@PathVariable UUID id) { return service.get(id); }

    @PutMapping("/{id}") @PreAuthorize("hasAuthority('MEDIA_UPLOAD')")
    public MediaDto update(@PathVariable UUID id, @Valid @RequestBody UpdateMediaRequest r) { return service.updateMetadata(id, r); }

    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('MEDIA_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean force) {
        service.delete(id, force);
        return ResponseEntity.noContent().build();
    }
}
