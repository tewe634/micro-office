package com.microoffice.config;

import com.microoffice.dto.response.ApiResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
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

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleAccessDenied(AccessDeniedException e) {
        return ApiResponse.error(403, "无权限访问");
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(Exception e) {
        BindingResult bindingResult = e instanceof MethodArgumentNotValidException ex
            ? ex.getBindingResult()
            : ((BindException) e).getBindingResult();
        return ApiResponse.error(400, formatBindingResultMessage(bindingResult));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleConstraintViolation(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
            .findFirst()
            .map(this::formatConstraintViolationMessage)
            .orElse("请求参数不合法");
        return ApiResponse.error(400, message);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleMissingServletRequestParameter(MissingServletRequestParameterException e) {
        return ApiResponse.error(400, "缺少必填参数: " + e.getParameterName());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleHttpMessageNotReadable(HttpMessageNotReadableException e) {
        return ApiResponse.error(400, "请求体格式错误或字段类型不匹配");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        return ApiResponse.error(400, "存在关联数据，无法删除，请先清理依赖项");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNoResourceFound(NoResourceFoundException e) {
        return ApiResponse.error(404, "接口不存在");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public org.springframework.http.ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException e) {
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        HttpStatus resolved = status == null ? HttpStatus.BAD_REQUEST : status;
        String message = e.getReason() == null || e.getReason().isBlank() ? resolved.getReasonPhrase() : e.getReason();
        return org.springframework.http.ResponseEntity.status(resolved).body(ApiResponse.error(resolved.value(), message));
    }

    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleRuntime(RuntimeException e) {
        return ApiResponse.error(400, e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception e) {
        return ApiResponse.error(500, "服务器内部错误");
    }

    private String formatBindingResultMessage(BindingResult bindingResult) {
        return bindingResult.getFieldErrors().stream()
            .findFirst()
            .map(this::formatFieldErrorMessage)
            .orElseGet(() -> bindingResult.getAllErrors().stream()
                .map(error -> error.getDefaultMessage())
                .filter(message -> message != null && !message.isBlank())
                .findFirst()
                .orElse("请求参数不合法"));
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
        String path = violation.getPropertyPath() == null ? "参数" : violation.getPropertyPath().toString();
        if (message == null || message.isBlank()) {
            return path + " 不合法";
        }
        return switch (message) {
            case "must not be blank", "must not be null" -> path + " 不能为空";
            default -> message;
        };
    }
}
