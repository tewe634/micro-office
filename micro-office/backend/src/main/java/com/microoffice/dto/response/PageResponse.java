package com.microoffice.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class PageResponse<T> {
    private long current;
    private long size;
    private long total;
    private List<T> records;

    public PageResponse(long current, long size, long total, List<T> records) {
        this.current = current;
        this.size = size;
        this.total = total;
        this.records = records;
    }
}
