package ma.anagem.cms.repository;

import ma.anagem.cms.entity.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface HomepageSectionRepository extends JpaRepository<HomepageSection, Long> {
    Optional<HomepageSection> findBySectionKey(String key);
    List<HomepageSection> findAllByOrderBySortOrderAscIdAsc();
}
