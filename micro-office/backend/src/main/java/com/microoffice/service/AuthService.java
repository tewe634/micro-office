package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.dto.request.LoginRequest;
import com.microoffice.dto.request.RegisterRequest;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public Map<String, Object> register(RegisterRequest req) {
        SysUser user = new SysUser();
        user.setName(req.getName());
        user.setEmail(req.getEmail());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setPhone(req.getPhone());
        user.setOrgId(req.getOrgId());
        user.setPrimaryPositionId(req.getPrimaryPositionId());
        user.setRole("STAFF");
        userMapper.insert(user);
        String token = jwtUtil.generateToken(user.getId(), user.getRole());
        return Map.of("token", token, "userId", user.getId(), "role", user.getRole());
    }

    public Map<String, Object> login(LoginRequest req) {
        SysUser user = userMapper.selectOne(
            new LambdaQueryWrapper<SysUser>().eq(SysUser::getEmail, req.getEmail()));
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("邮箱或密码错误");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getRole());
        return Map.of("token", token, "userId", user.getId(), "role", user.getRole());
    }
}
