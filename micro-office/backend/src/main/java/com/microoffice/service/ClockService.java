package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.ClockRecord;
import com.microoffice.enums.ClockType;
import com.microoffice.mapper.ClockRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClockService {
    private final ClockRecordMapper mapper;

    public ClockRecord punch(Integer userId, ClockType type) {
        ClockRecord r = new ClockRecord();
        r.setUserId(userId);
        r.setType(type);
        r.setClockTime(OffsetDateTime.now());
        mapper.insert(r);
        return r;
    }

    public List<ClockRecord> today(Integer userId) {
        OffsetDateTime start = LocalDate.now().atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime end = LocalDate.now().atTime(LocalTime.MAX).atOffset(ZoneOffset.UTC);
        return mapper.selectList(new LambdaQueryWrapper<ClockRecord>()
                .eq(ClockRecord::getUserId, userId)
                .between(ClockRecord::getClockTime, start, end)
                .orderByAsc(ClockRecord::getClockTime));
    }
}
