package ma.anagem.cms.repository;

import ma.anagem.cms.entity.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    Optional<Category> findByTypeAndSlug(CategoryType type, String slug);
    boolean existsByTypeAndSlug(CategoryType type, String slug);
    List<Category> findByTypeOrderBySortOrderAscIdAsc(CategoryType type);
    List<Category> findByTypeAndActiveTrueOrderBySortOrderAscIdAsc(CategoryType type);
}
