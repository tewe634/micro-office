package com.microoffice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.microoffice.entity.AuthSession;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuthSessionMapper extends BaseMapper<AuthSession> {
}
