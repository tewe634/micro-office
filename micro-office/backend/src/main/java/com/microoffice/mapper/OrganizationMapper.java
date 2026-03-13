package com.microoffice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.microoffice.entity.Organization;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface OrganizationMapper extends BaseMapper<Organization> {
}
