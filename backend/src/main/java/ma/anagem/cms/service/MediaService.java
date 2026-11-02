package ma.anagem.cms.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Predicate;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.PageResponse;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.dto.MediaDtos.*;
import ma.anagem.cms.entity.MediaFile;
import ma.anagem.cms.entity.MediaKind;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.MediaMapper;
import ma.anagem.cms.repository.MediaFileRepository;
import ma.anagem.cms.repository.UserRepository;
import ma.anagem.cms.security.CurrentUser;
import ma.anagem.cms.storage.DetectedType;
import ma.anagem.cms.storage.FileStorage;
import ma.anagem.cms.storage.ImageProcessor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class MediaService {
    private static final Pattern UNSAFE_NAME = Pattern.compile("[^\\p{L}\\p{N} ._()-]");
    private final MediaFileRepository repo;
    private final UserRepository users;
    private final FileStorage storage;
    private final ImageProcessor images;
    private final AppProperties props;
    private final AuditService audit;
    private final EntityManager em;

    public record Served(Resource resource, MediaFile media, boolean thumbnail) {}

    @Transactional
    public MediaDto upload(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("EMPTY_FILE", "No file was uploaded");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw ApiException.badRequest("UNREADABLE_FILE", "The file could not be read"); }
        DetectedType type = DetectedType.detect(bytes);
        if (type == null) throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_FILE_TYPE", "Only JPEG, PNG, GIF, WebP images and PDF documents are accepted");
        long limit = (type == DetectedType.PDF ? props.storage().maxPdfSize() : props.storage().maxImageSize()).toBytes();
        if (bytes.length > limit) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "File exceeds the " + (limit / 1_048_576) + " MB limit for this type");

        byte[] main = bytes, thumb = null;
        Integer width = null, height = null;
        try {
            if (type == DetectedType.JPEG || type == DetectedType.PNG) {
                var r = images.process(bytes, type);
                main = r.data(); thumb = r.thumbnail(); width = r.width(); height = r.height();
            } else if (type == DetectedType.GIF) {
                var s = images.probe(bytes);
                width = s.width(); height = s.height();
            }
        } catch (IOException e) {
            throw ApiException.badRequest("INVALID_IMAGE", "The image is corrupted or too large");
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String base = "%d/%02d/%s".formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID());
        String key = base + "." + type.extension, thumbKey = thumb == null ? null : base + "-thumb." + type.extension;
        try {
            storage.store(key, main);
            if (thumbKey != null) storage.store(thumbKey, thumb);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "The file could not be saved");
        }

        MediaFile m = new MediaFile();
        m.setStorageKey(key); m.setThumbnailKey(thumbKey);
        m.setOriginalName(safeName(file.getOriginalFilename()));
        m.setContentType(type.contentType); m.setKind(type.kind);
        m.setSizeBytes(main.length); m.setWidth(width); m.setHeight(height);
        m.setChecksumSha256(sha256(main));
        m.setUploadedBy(users.getReferenceById(CurrentUser.require().id()));
        try {
            repo.saveAndFlush(m);
        } catch (RuntimeException e) {
            storage.delete(key); if (thumbKey != null) storage.delete(thumbKey);
            throw e;
        }
        audit.log(AuditAction.UPLOAD, "MEDIA", m.getId(), m.getOriginalName() + " (" + type + ", " + main.length + " bytes)");
        return MediaMapper.toDto(m);
    }

    @Transactional(readOnly = true)
    public PageResponse<MediaDto> list(String q, MediaKind kind, int page, int size) {
        Specification<MediaFile> spec = (root, cq, cb) -> {
            Predicate p = cb.conjunction();
            if (q != null && !q.isBlank()) p = cb.and(p, cb.like(cb.lower(root.get("originalName")), "%" + q.trim().toLowerCase() + "%"));
            if (kind != null) p = cb.and(p, cb.equal(root.get("kind"), kind));
            return p;
        };
        var pg = repo.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(pg, MediaMapper::toDto);
    }

    @Transactional(readOnly = true)
    public MediaDto get(UUID id) { return MediaMapper.toDto(find(id)); }

    @Transactional
    public MediaDto updateMetadata(UUID id, UpdateMediaRequest r) {
        MediaFile m = find(id);
        for (String code : r.translations().keySet()) if (!Lang.isSupported(code)) throw ApiException.badRequest("UNSUPPORTED_LOCALE", "Unsupported language: " + code);
        m.getTranslations().clear();
        r.translations().forEach((k, v) -> m.getTranslations().put(k, MediaMapper.text(v)));
        audit.log(AuditAction.UPDATE, "MEDIA", id, "Updated descriptions of " + m.getOriginalName());
        return MediaMapper.toDto(m);
    }

    @Transactional
    public void delete(UUID id, boolean force) {
        MediaFile m = find(id);
        long uses = ((Number) em.createNativeQuery("""
                select (select count(*) from news where featured_image_id = :id)
                     + (select count(*) from publications where cover_image_id = :id or pdf_file_id = :id)
                     + (select count(*) from events where image_id = :id or program_file_id = :id)
                     + (select count(*) from resources where file_id = :id)
                     + (select count(*) from partners where logo_id = :id)""").setParameter("id", id).getSingleResult()).longValue();
        if (uses > 0 && !force) throw ApiException.conflict("MEDIA_IN_USE", "This file is used by " + uses + " item(s); detach it first or force deletion");
        String key = m.getStorageKey(), thumb = m.getThumbnailKey();
        repo.delete(m);
        repo.flush();
        storage.delete(key);
        if (thumb != null) storage.delete(thumb);
        audit.log(AuditAction.DELETE, "MEDIA", id, "Deleted " + m.getOriginalName());
    }

    @Transactional(readOnly = true)
    public Served openForServing(UUID id, boolean thumbnail) {
        MediaFile m = find(id);
        boolean useThumb = thumbnail && m.getThumbnailKey() != null;
        return new Served(storage.load(useThumb ? m.getThumbnailKey() : m.getStorageKey()), m, useThumb);
    }

    MediaFile find(UUID id) { return repo.findById(id).orElseThrow(() -> ApiException.notFound("File")); }

    /** Fetch a media reference for linking from content; 400 when the id does not exist. Optionally enforces the expected kind. */
    public MediaFile require(UUID id, MediaKind expected, String field) {
        if (id == null) return null;
        MediaFile m = repo.findById(id).orElseThrow(() -> ApiException.badRequest("UNKNOWN_MEDIA", field + ": file not found"));
        if (expected != null && m.getKind() != expected) throw ApiException.badRequest("WRONG_MEDIA_KIND", field + " must be a " + expected);
        return m;
    }

    private static String safeName(String original) {
        String n = original == null ? "" : original.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1);
        n = UNSAFE_NAME.matcher(n).replaceAll("_").strip();
        if (n.length() > 200) n = n.substring(0, 200);
        return n.isBlank() ? "file" : n;
    }

    private static String sha256(byte[] data) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
