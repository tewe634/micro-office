package com.microoffice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.microoffice.entity.Product;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ProductMapper extends BaseMapper<Product> {
}
