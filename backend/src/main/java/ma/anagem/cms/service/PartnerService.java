package ma.anagem.cms.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.common.Lang;
import ma.anagem.cms.common.Localized;
import ma.anagem.cms.dto.PartnerDtos.*;
import ma.anagem.cms.entity.MediaKind;
import ma.anagem.cms.entity.Partner;
import ma.anagem.cms.entity.PartnerText;
import ma.anagem.cms.exception.ApiException;
import ma.anagem.cms.mapper.MediaMapper;
import ma.anagem.cms.repository.PartnerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PartnerService {
    private final PartnerRepository repo;
    private final MediaService media;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<PartnerPublicDto> publicList(Lang lang) {
        return repo.findByActiveTrueOrderBySortOrderAscIdAsc().stream().map(p -> {
            var pick = Localized.pick(p.getTranslations(), lang, t -> t.getName() != null && !t.getName().isBlank());
            return new PartnerPublicDto(p.getId(), pick == null ? p.getName() : pick.value().getName(), p.getWebsiteUrl(), MediaMapper.ref(p.getLogo(), lang));
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<PartnerAdminDto> adminList() { return repo.findAllByOrderBySortOrderAscIdAsc().stream().map(this::toAdmin).toList(); }

    @Transactional
    public PartnerAdminDto create(PartnerRequest r) {
        Partner p = new Partner();
        apply(p, r);
        repo.save(p);
        audit.log(AuditAction.CREATE, "PARTNER", p.getId(), "Created partner " + p.getName());
        return toAdmin(p);
    }

    @Transactional
    public PartnerAdminDto update(Long id, PartnerRequest r) {
        Partner p = repo.findById(id).orElseThrow(() -> ApiException.notFound("Partner"));
        apply(p, r);
        audit.log(AuditAction.UPDATE, "PARTNER", id, "Updated partner " + p.getName());
        return toAdmin(p);
    }

    @Transactional
    public void delete(Long id) {
        Partner p = repo.findById(id).orElseThrow(() -> ApiException.notFound("Partner"));
        repo.delete(p);
        audit.log(AuditAction.DELETE, "PARTNER", id, "Deleted partner " + p.getName());
    }

    private void apply(Partner p, PartnerRequest r) {
        p.setName(r.name().trim());
        p.setWebsiteUrl(r.websiteUrl() == null || r.websiteUrl().isBlank() ? null : r.websiteUrl().trim());
        p.setLogo(media.require(r.logoId(), MediaKind.IMAGE, "logoId"));
        if (r.sortOrder() != null) p.setSortOrder(r.sortOrder());
        if (r.active() != null) p.setActive(r.active());
        p.getTranslations().clear();
        if (r.translations() != null) {
            ContentWorkflow.requireSupported(r.translations().keySet());
            r.translations().forEach((k, v) -> p.getTranslations().put(k, new PartnerText(v.name().trim())));
        }
    }

    private PartnerAdminDto toAdmin(Partner p) {
        Map<String, PartnerNameDto> tr = new LinkedHashMap<>();
        p.getTranslations().forEach((k, v) -> tr.put(k, new PartnerNameDto(v.getName())));
        return new PartnerAdminDto(p.getId(), p.getName(), p.getWebsiteUrl(), p.getLogo() == null ? null : MediaMapper.toDto(p.getLogo()), p.getSortOrder(), p.isActive(), tr);
    }
}
