package ma.anagem.cms.repository;

import ma.anagem.cms.entity.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RevokedTokenRepository extends JpaRepository<RevokedToken, String> {
    @Modifying @Query("delete from RevokedToken t where t.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
