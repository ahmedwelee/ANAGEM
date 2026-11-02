package ma.anagem.cms.service;

import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.entity.ContentBase;
import ma.anagem.cms.entity.Event;
import ma.anagem.cms.entity.News;
import ma.anagem.cms.entity.Publication;
import ma.anagem.cms.entity.Resource;
import ma.anagem.cms.repository.EventRepository;
import ma.anagem.cms.repository.NewsRepository;
import ma.anagem.cms.repository.PublicationRepository;
import ma.anagem.cms.repository.ResourceRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public URLs of the website, for sitemap.xml generation by the web server. */
@Service
@RequiredArgsConstructor
public class SitemapService {
    private static final int LIMIT = 5000;
    private final NewsRepository news;
    private final EventRepository events;
    private final PublicationRepository publications;
    private final ResourceRepository resources;

    public record Entry(String ref, Instant updatedAt) {}

    public record SitemapDto(List<Entry> news, List<Entry> events, List<Entry> publications, List<Entry> resources) {}

    @Transactional(readOnly = true)
    public SitemapDto build() {
        Instant now = Instant.now();
        var page = PageRequest.of(0, LIMIT, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return new SitemapDto(
                news.findAll(live(now), page).stream().map(n -> new Entry(n.getSlug(), n.getUpdatedAt())).toList(),
                events.findAll(live(now), page).stream().map(e -> new Entry(e.getSlug(), e.getUpdatedAt())).toList(),
                publications.findAll(live(now), page).stream().map(p -> new Entry(String.valueOf(p.getId()), p.getUpdatedAt())).toList(),
                resources.findAll(live(now), page).stream().map(r -> new Entry(String.valueOf(r.getId()), r.getUpdatedAt())).toList());
    }

    private <T extends ContentBase> Specification<T> live(Instant now) { return (root, cq, cb) -> SpecSupport.isPublic(root, cb, now); }
}
