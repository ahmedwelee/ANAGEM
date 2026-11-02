package ma.anagem.cms.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private ResponseEntity<ApiError> build(HttpStatus s, String code, String msg, HttpServletRequest r, List<ApiError.FieldIssue> f) {
        return ResponseEntity.status(s).body(new ApiError(Instant.now(), s.value(), code, msg, r.getRequestURI(), f));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException e, HttpServletRequest r) { return build(e.status(), e.code(), e.getMessage(), r, null); }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e, HttpServletRequest r) {
        var issues = e.getBindingResult().getFieldErrors().stream().map(x -> new ApiError.FieldIssue(x.getField(), x.getDefaultMessage())).toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", r, issues);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> constraint(ConstraintViolationException e, HttpServletRequest r) {
        var issues = e.getConstraintViolations().stream().map(v -> new ApiError.FieldIssue(v.getPropertyPath().toString(), v.getMessage())).toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Validation failed", r, issues);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    ResponseEntity<ApiError> malformed(Exception e, HttpServletRequest r) { return build(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Malformed request", r, null); }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ApiError> auth(AuthenticationException e, HttpServletRequest r) { return build(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required", r, null); }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> denied(AccessDeniedException e, HttpServletRequest r) { return build(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "You do not have permission to perform this action", r, null); }

    @ExceptionHandler({OptimisticLockingFailureException.class})
    ResponseEntity<ApiError> locking(Exception e, HttpServletRequest r) { return build(HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION", "The item was modified by someone else; reload and retry", r, null); }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrity(DataIntegrityViolationException e, HttpServletRequest r) {
        log.warn("Data integrity violation: {}", e.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, "DATA_CONFLICT", "The change conflicts with existing data (duplicate or still referenced)", r, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> tooLarge(Exception e, HttpServletRequest r) { return build(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "File is too large", r, null); }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> method(Exception e, HttpServletRequest r) { return build(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "Method not allowed", r, null); }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> mediaType(Exception e, HttpServletRequest r) { return build(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", "Unsupported content type", r, null); }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> noResource(Exception e, HttpServletRequest r) { return build(HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found", r, null); }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e, HttpServletRequest r) {
        log.error("Unexpected error on {} {}", r.getMethod(), r.getRequestURI(), e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected error", r, null);
    }
}
