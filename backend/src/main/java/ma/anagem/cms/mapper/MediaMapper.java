package ma.anagem.cms.mapper;

import java.util.LinkedHashMap;
import java.util.Map;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.MediaDtos.*;
import ma.anagem.cms.entity.MediaFile;
import ma.anagem.cms.entity.MediaKind;
import ma.anagem.cms.entity.MediaText;

public final class MediaMapper {
    private MediaMapper() {}

    public static String url(MediaFile m) { return "/api/public/media/" + m.getId(); }

    public static String thumbUrl(MediaFile m) { return m.getKind() == MediaKind.IMAGE ? url(m) + "/thumbnail" : null; }

    public static MediaDto toDto(MediaFile m) {
        Map<String, MediaTextDto> tr = new LinkedHashMap<>();
        m.getTranslations().forEach((k, v) -> tr.put(k, new MediaTextDto(v.getAltText(), v.getDescription())));
        return new MediaDto(m.getId(), m.getOriginalName(), m.getContentType(), m.getKind().name(), m.getSizeBytes(), m.getWidth(), m.getHeight(),
                url(m), thumbUrl(m), tr, m.getCreatedAt(), m.getUploadedBy() == null ? null : m.getUploadedBy().getFullName());
    }

    public static MediaRef ref(MediaFile m, Lang lang) {
        if (m == null) return null;
        var alt = Localized.pick(m.getTranslations(), lang, t -> t.getAltText() != null && !t.getAltText().isBlank());
        return new MediaRef(m.getId(), url(m), thumbUrl(m), alt == null ? null : alt.value().getAltText(), m.getWidth(), m.getHeight(), m.getContentType());
    }

    public static MediaText text(MediaTextDto d) {
        MediaText t = new MediaText();
        t.setAltText(blankToNull(d.altText()));
        t.setDescription(blankToNull(d.description()));
        return t;
    }

    static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
}
