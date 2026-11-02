package ma.anagem.cms.repository;

import ma.anagem.cms.entity.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PublicationRepository extends JpaRepository<Publication, Long>, JpaSpecificationExecutor<Publication> {
    long countByCategory_Id(Long categoryId);

    @Query("select distinct p.publicationYear from Publication p where p.status in :statuses and p.publishedAt <= :now order by p.publicationYear desc")
    List<Integer> publicYears(@Param("statuses") Collection<ma.anagem.cms.common.ContentStatus> statuses, @Param("now") Instant now);
}
