package com.microoffice.config;

import com.microoffice.dto.response.ApiResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleAccessDenied(AccessDeniedException e) {
        return ApiResponse.error(403, "无权限访问", "FORBIDDEN");
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(Exception e) {
        BindingResult bindingResult = e instanceof MethodArgumentNotValidException ex
            ? ex.getBindingResult()
            : ((BindException) e).getBindingResult();
        return buildBindingValidationError(bindingResult);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleConstraintViolation(ConstraintViolationException e) {
        ConstraintViolation<?> violation = e.getConstraintViolations().stream().findFirst().orElse(null);
        if (violation == null) {
            return ApiResponse.error(400, "请求参数不合法", "VALIDATION_ERROR");
        }
        String field = extractLeafProperty(violation.getPropertyPath() == null ? null : violation.getPropertyPath().toString());
        String message = formatConstraintViolationMessage(violation);
        return buildValidationError(field, message);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleMissingServletRequestParameter(MissingServletRequestParameterException e) {
        return buildValidationError(e.getParameterName(), "缺少必填参数: " + e.getParameterName());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleHttpMessageNotReadable(HttpMessageNotReadableException e) {
        return ApiResponse.error(400, "请求体格式错误或字段类型不匹配", "REQUEST_BODY_INVALID");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        return ApiResponse.error(400, "存在关联数据，无法删除，请先清理依赖项", "DATA_INTEGRITY_ERROR");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNoResourceFound(NoResourceFoundException e) {
        return ApiResponse.error(404, "接口不存在", "NOT_FOUND");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException e) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        HttpStatus resolved = status == null ? HttpStatus.BAD_REQUEST : status;
        String message = e.getReason() == null || e.getReason().isBlank() ? resolved.getReasonPhrase() : e.getReason();
        return ResponseEntity.status(resolved)
            .body(ApiResponse.error(resolved.value(), message, mapErrorType(resolved)));
    }

    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleRuntime(RuntimeException e) {
        return ApiResponse.error(400, defaultIfBlank(e.getMessage(), "请求失败"), "BUSINESS_ERROR");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception e) {
        return ApiResponse.error(500, "服务器内部错误", "INTERNAL_ERROR");
    }

    private ApiResponse<Void> buildBindingValidationError(BindingResult bindingResult) {
        List<ApiResponse.ApiFieldError> fieldErrors = collectBindingFieldErrors(bindingResult);
        if (!fieldErrors.isEmpty()) {
            ApiResponse.ApiFieldError first = fieldErrors.get(0);
            return ApiResponse.error(400, first.getMessage(), "VALIDATION_ERROR", first.getField(), fieldErrors);
        }
        String message = bindingResult.getAllErrors().stream()
            .map(error -> error.getDefaultMessage())
            .filter(value -> value != null && !value.isBlank())
            .findFirst()
            .orElse("请求参数不合法");
        return ApiResponse.error(400, message, "VALIDATION_ERROR");
    }

    private List<ApiResponse.ApiFieldError> collectBindingFieldErrors(BindingResult bindingResult) {
        Map<String, ApiResponse.ApiFieldError> dedupedErrors = new LinkedHashMap<>();
        for (FieldError error : bindingResult.getFieldErrors()) {
            dedupedErrors.putIfAbsent(error.getField(), new ApiResponse.ApiFieldError(error.getField(), formatFieldErrorMessage(error)));
        }
        return new ArrayList<>(dedupedErrors.values());
    }

    private ApiResponse<Void> buildValidationError(String field, String message) {
        if (field == null || field.isBlank()) {
            return ApiResponse.error(400, message, "VALIDATION_ERROR");
        }
        return ApiResponse.error(400, message, "VALIDATION_ERROR", field,
            List.of(new ApiResponse.ApiFieldError(field, message)));
    }

    private String formatFieldErrorMessage(FieldError error) {
        String message = error.getDefaultMessage();
        String field = error.getField();
        if (message == null || message.isBlank()) {
            return field + " 参数不合法";
        }
        return switch (message) {
            case "must not be blank", "must not be null" -> field + " 不能为空";
            default -> message;
        };
    }

    private String formatConstraintViolationMessage(ConstraintViolation<?> violation) {
        String message = violation.getMessage();
        String field = extractLeafProperty(violation.getPropertyPath() == null ? null : violation.getPropertyPath().toString());
        String fieldLabel = field == null || field.isBlank() ? "参数" : field;
        if (message == null || message.isBlank()) {
            return fieldLabel + " 不合法";
        }
        return switch (message) {
            case "must not be blank", "must not be null" -> fieldLabel + " 不能为空";
            default -> message;
        };
    }

    private String extractLeafProperty(String propertyPath) {
        if (propertyPath == null || propertyPath.isBlank()) {
            return null;
        }
        String[] segments = propertyPath.split("\\.");
        for (int i = segments.length - 1; i >= 0; i--) {
            String segment = segments[i];
            if (segment != null && !segment.isBlank()) {
                return segment;
            }
        }
        return propertyPath;
    }

    private String defaultIfBlank(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private String mapErrorType(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "BAD_REQUEST";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case FORBIDDEN -> "FORBIDDEN";
            case NOT_FOUND -> "NOT_FOUND";
            case CONFLICT -> "CONFLICT";
            case UNPROCESSABLE_ENTITY -> "VALIDATION_ERROR";
            default -> status.is5xxServerError() ? "INTERNAL_ERROR" : status.name();
        };
    }
}
