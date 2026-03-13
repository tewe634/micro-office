package com.microoffice.dto.request;

import lombok.Data;

@Data
public class CompleteNodeRequest {
    private String nextAction;      // NEXT_TEMPLATE / ASSIGN / POOL / MODULE / CUSTOM / COMPLETE_TASK / DEFER
    private Integer assignToUserId;
    private Integer poolPositionId;
    private String customNodeName;
}
