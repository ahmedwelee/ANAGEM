package ma.anagem.cms.exception;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import java.util.stream.Collectors;
import ma.anagem.cms.dto.UserDtos.LoginRequest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** The cases MockMvc cannot easily provoke: each one must map to a clean status and a stable error code, never a stack trace. */
class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/admin/news/7");

    private void expect(ResponseEntity<ApiError> r, HttpStatus status, String code) {
        assertThat(r.getStatusCode()).isEqualTo(status);
        assertThat(r.getBody()).isNotNull();
        assertThat(r.getBody().code()).isEqualTo(code);
        assertThat(r.getBody().status()).isEqualTo(status.value());
        assertThat(r.getBody().path()).isEqualTo("/api/admin/news/7");
        assertThat(r.getBody().timestamp()).isNotNull();
    }

    @Test
    void businessErrorsKeepTheirStatusCodeAndMessage() {
        var r = handler.api(ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists"), request);
        expect(r, HttpStatus.CONFLICT, "EMAIL_TAKEN");
        assertThat(r.getBody().message()).isEqualTo("An account with this email already exists");
        expect(handler.api(ApiException.notFound("Partner"), request), HttpStatus.NOT_FOUND, "NOT_FOUND");
        expect(handler.api(ApiException.forbidden("PUBLISH_FORBIDDEN", "no"), request), HttpStatus.FORBIDDEN, "PUBLISH_FORBIDDEN");
    }

    @Test
    void beanValidationViolationsListEachFieldOnce() {
        var violations = Validation.buildDefaultValidatorFactory().getValidator().validate(new LoginRequest("nope", ""));
        var r = handler.constraint(new ConstraintViolationException(violations), request);
        expect(r, HttpStatus.BAD_REQUEST, "VALIDATION_FAILED");
        var fields = r.getBody().fieldErrors().stream().map(ApiError.FieldIssue::field).collect(Collectors.toSet());
        assertThat(fields).contains("email", "password");
    }

    @Test
    void securityErrorsAreAuthenticationOrPermissionProblems() {
        expect(handler.auth(new BadCredentialsException("x"), request), HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
        expect(handler.denied(new AccessDeniedException("x"), request), HttpStatus.FORBIDDEN, "ACCESS_DENIED");
    }

    @Test
    void concurrentEditsAndDuplicatesAreConflictsNotServerErrors() {
        expect(handler.locking(new OptimisticLockingFailureException("stale"), request), HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION");
        expect(handler.integrity(new DataIntegrityViolationException("duplicate key value violates unique constraint \"uq_news_slug\""), request), HttpStatus.CONFLICT, "DATA_CONFLICT");
    }

    @Test
    void databaseDetailsNeverReachTheClient() {
        var r = handler.integrity(new DataIntegrityViolationException("duplicate key value violates unique constraint \"uq_news_slug\""), request);
        assertThat(r.getBody().message()).doesNotContain("uq_news_slug").doesNotContain("constraint");
    }

    @Test
    void tooLargeUploadsAreReportedAs413() {
        expect(handler.tooLarge(new MaxUploadSizeExceededException(60L * 1024 * 1024), request), HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE");
    }

    @Test
    void anythingUnexpectedIsAGenericInternalErrorWithoutDetails() {
        var r = handler.unexpected(new IllegalStateException("secret internal detail: jdbc:postgresql://db/anagem password=hunter2"), request);
        expect(r, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
        assertThat(r.getBody().message()).isEqualTo("Unexpected error");
        assertThat(r.getBody().toString()).doesNotContain("hunter2").doesNotContain("jdbc");
    }
}
