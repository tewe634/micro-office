package com.microoffice.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;
    private String errorType;
    private String field;
    private List<ApiFieldError> errors;

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(0, "success", data, null, null, null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null, null, null, null);
    }

    public static <T> ApiResponse<T> error(int code, String message, String errorType) {
        return new ApiResponse<>(code, message, null, errorType, null, null);
    }

    public static <T> ApiResponse<T> error(int code, String message, String errorType, String field, List<ApiFieldError> errors) {
        return new ApiResponse<>(code, message, null, errorType, field,
            errors == null || errors.isEmpty() ? null : errors);
    }

    @Data
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ApiFieldError {
        private String field;
        private String message;
    }
}
