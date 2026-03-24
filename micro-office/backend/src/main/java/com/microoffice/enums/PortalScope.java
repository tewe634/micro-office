package com.microoffice.enums;

import java.util.Arrays;

public enum PortalScope {
    PERSONAL("personal", "个人"),
    DEPARTMENT("department", "部门"),
    BUSINESS("business", "业务部"),
    SYSTEM("system", "销售体系");

    private final String key;
    private final String label;

    PortalScope(String key, String label) {
        this.key = key;
        this.label = label;
    }

    public String getKey() {
        return key;
    }

    public String getLabel() {
        return label;
    }

    public static PortalScope fromKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        return Arrays.stream(values())
            .filter(scope -> scope.key.equalsIgnoreCase(key))
            .findFirst()
            .orElse(null);
    }
}
