package ma.anagem.cms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "permissions") @Getter @Setter @NoArgsConstructor
public class Permission {
    @Id @Column(length = 64) private String code;
    private String description;
}
