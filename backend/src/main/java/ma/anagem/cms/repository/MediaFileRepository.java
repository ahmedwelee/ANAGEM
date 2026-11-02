package ma.anagem.cms.repository;

import ma.anagem.cms.entity.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MediaFileRepository extends JpaRepository<MediaFile, UUID>, JpaSpecificationExecutor<MediaFile> {
}
