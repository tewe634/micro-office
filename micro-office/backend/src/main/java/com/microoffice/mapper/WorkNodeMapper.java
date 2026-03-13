package com.microoffice.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.microoffice.entity.WorkNode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface WorkNodeMapper extends BaseMapper<WorkNode> {

    @Select("SELECT * FROM work_node WHERE pool_position_id = #{positionId} AND status = 'IN_PROGRESS' AND owner_id IS NULL")
    List<WorkNode> selectPoolTasks(@Param("positionId") Integer positionId);
}
