package ma.anagem.cms.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import ma.anagem.cms.entity.ContactStatus;

public final class OpsDtos {
    private OpsDtos() {}

    public record ContactRequest(@NotBlank @Size(max = 150) String name, @NotBlank @Email @Size(max = 255) String email, @Size(max = 250) String subject,
                                 @NotBlank @Size(min = 10, max = 5000) String message, @Pattern(regexp = "fr|ar|en") String locale,
                                 String website /* honeypot: real visitors never fill this hidden field; ContactService drops submissions that do */) {}

    public record ContactMessageDto(Long id, String name, String email, String subject, String message, String locale, ContactStatus status, Instant createdAt, Instant handledAt) {}

    public record UpdateContactStatusRequest(@NotNull ContactStatus status) {}

    public record AuditLogDto(Long id, Instant occurredAt, Long actorId, String actorEmail, String action, String resourceType, String resourceId, String summary, String ipAddress) {}

    public record StatusCounts(long total, Map<String, Long> byStatus) {}

    public record TranslationGap(Long id, String title, List<String> missingLocales) {}

    public record TranslationGapReport(long incomplete, List<TranslationGap> items) {}

    public record EventStats(long total, Map<String, Long> byStatus, long upcoming, long past) {}

    public record MonthCount(String month, long count) {}

    public record DashboardStats(StatusCounts news, StatusCounts publications, EventStats events, StatusCounts resources, long mediaFiles, long newContactMessages,
                                 Long adminUsers, List<MonthCount> newsPerMonth, Map<String, TranslationGapReport> translationGaps) {}
}
