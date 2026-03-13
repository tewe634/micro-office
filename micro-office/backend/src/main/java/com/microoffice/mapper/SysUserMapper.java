package com.microoffice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.microoffice.entity.SysUser;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SysUserMapper extends BaseMapper<SysUser> {
}
