package com.microoffice.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateThreadRequest {
    @NotBlank
    private String title;
    private String content;
    private Integer objectId;
    private Integer templateId;
    private Integer productId;
    private Integer assignToUserId;
    private String firstNodeName;
}
