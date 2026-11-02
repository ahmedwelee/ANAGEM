package ma.anagem.cms.controller.pub;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.service.MediaService;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;

/** Files are addressed by random UUID only; storage paths are never exposed. */
@RestController
@RequestMapping("/api/public/media")
@RequiredArgsConstructor
public class PublicMediaController {
    private final MediaService service;
    private final AppProperties props;

    @GetMapping("/{id}")
    public ResponseEntity<Resource> file(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean download, WebRequest request) {
        return serve(id, false, download, request);
    }

    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> thumbnail(@PathVariable UUID id, WebRequest request) { return serve(id, true, false, request); }

    private ResponseEntity<Resource> serve(UUID id, boolean thumb, boolean download, WebRequest request) {
        var served = service.openForServing(id, thumb);
        String etag = "\"" + served.media().getChecksumSha256() + (served.thumbnail() ? "-t" : "") + "\"";
        if (request.checkNotModified(etag)) return ResponseEntity.status(304).eTag(etag).build();
        ContentDisposition cd = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(served.media().getOriginalName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(served.thumbnail() ? served.media().getContentType() : served.media().getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, cd.toString())
                .header("Content-Security-Policy", "frame-ancestors 'self' " + props.publicBaseUrl()) // lets the website embed PDFs for preview
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .eTag(etag)
                .body(served.resource());
    }
}
