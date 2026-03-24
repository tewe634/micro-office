package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ExternalObject;
import com.microoffice.entity.Product;
import com.microoffice.entity.SysUser;
import com.microoffice.enums.ObjectType;
import com.microoffice.mapper.ProductMapper;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.DataScopeService;
import com.microoffice.service.ExternalObjectAccessService;
import com.microoffice.service.ExternalObjectService;
import com.microoffice.service.MenuPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api/portal")
@RequiredArgsConstructor
public class PortalController {
    private final SysUserMapper userMapper;
    private final ProductMapper productMapper;
    private final ExternalObjectService externalObjectService;
    private final JdbcTemplate jdbc;
    private final DataScopeService dataScopeService;
    private final ExternalObjectAccessService objectAccessService;
    private final MenuPermissionService menuPermissionService;

    @GetMapping("/products/{id}")
    public ApiResponse<Map<String, Object>> productPortal(@PathVariable String id,
                                                          @RequestParam(required = false) String scope,
                                                          Authentication auth) {
        String viewerId = (String) auth.getPrincipal();
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "产品不存在");
        }
        return ApiResponse.ok(buildProductPortal(product, resolveSalesPortalScope(viewerId, scope)));
    }

    @GetMapping("/objects/{id}")
    public ApiResponse<Map<String, Object>> objectPortal(@PathVariable String id,
                                                         @RequestParam(required = false) String scope,
                                                         Authentication auth) {
        String viewerId = (String) auth.getPrincipal();
        ExternalObject object = requireAccessibleObject(id, viewerId);
        if (object.getType() == ObjectType.CUSTOMER) {
            return ApiResponse.ok(buildCustomerPortal(object, viewerId));
        }
        return ApiResponse.ok(buildObjectPortal(object));
    }

    @GetMapping("/users/{id}")
    public ApiResponse<Map<String, Object>> userPortal(@PathVariable String id,
                                                       @RequestParam(required = false) String positionId,
                                                       Authentication auth) {
        String viewerId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(viewerId, "/users");

        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }

        List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(viewerId);
        if (!dataScopeService.isGlobalAdmin(viewerId) && (user.getOrgId() == null || !visibleOrgIds.contains(user.getOrgId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该用户");
        }
        return ApiResponse.ok(buildUserPortal(user, positionId));
    }

    private ExternalObject requireAccessibleObject(String id, String viewerId) {
        ExternalObject object = externalObjectService.getById(id);
        if (object == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "对象不存在");
        }
        if (dataScopeService.isGlobalAdmin(viewerId)) {
            return object;
        }

        List<String> allowedTypes = getAllowedTypes(viewerId);
        boolean typeAllowed = object.getType() != null && (allowedTypes.isEmpty() || allowedTypes.contains(object.getType().name()));
        if (!typeAllowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该对象");
        }

        boolean accessible = objectAccessService.canAccess(
            object,
            objectAccessService.buildContext(viewerId),
            dataScopeService.getScopeOrgIds(viewerId)
        );
        if (!accessible) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该对象");
        }
        return object;
    }

    private List<String> getAllowedTypes(String userId) {
        List<String> personal = jdbc.queryForList(
            "SELECT object_type FROM user_object_type WHERE user_id = ?",
            String.class,
            userId
        );
        if (!personal.isEmpty()) {
            return personal;
        }
        return jdbc.queryForList(
            "SELECT DISTINCT pot.object_type FROM position_object_type pot " +
                "JOIN sys_user su ON su.primary_position_id = pot.position_id WHERE su.id = ? " +
                "UNION SELECT DISTINCT pot.object_type FROM position_object_type pot " +
                "JOIN user_position up ON up.position_id = pot.position_id WHERE up.user_id = ?",
            String.class,
            userId,
            userId
        );
    }

    private DataScopeService.SalesPortalScope resolveSalesPortalScope(String userId, String scope) {
        try {
            return dataScopeService.resolveSalesPortalScope(userId, scope);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    private Map<String, Object> buildProductPortal(Product product, DataScopeService.SalesPortalScope scopeContext) {
        int year = Year.now().getValue();
        int seed = stableSeed(product.getId() + "#" + scopeContext.activeScope().key(), 11);
        List<RefItem> salesRefs = pickRefs(loadSalesRefs(scopeContext), 3 + seed % 2, seed);
        List<RefItem> customerRefs = pickRefs(loadCustomerRefs(scopeContext), 4, seed / 3 + 5);

        List<Map<String, Object>> salesSummary = new ArrayList<>();
        List<Map<String, Object>> performanceItems = new ArrayList<>();
        Set<String> usedCustomerIds = new LinkedHashSet<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (int i = 0; i < salesRefs.size(); i++) {
            RefItem salesperson = salesRefs.get(i);
            int customerSpan = Math.min(customerRefs.size(), 1 + Math.floorMod(seed + i, Math.max(1, Math.min(3, customerRefs.size()))));
            for (int j = 0; j < customerSpan; j++) {
                RefItem customer = customerRefs.get((i + j) % customerRefs.size());
                BigDecimal amount = money(product.getId(), i * 13 + j * 7 + 1, 18, 46);
                totalAmount = totalAmount.add(amount);
                usedCustomerIds.add(refKey(customer));

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", "product-sale-" + i + "-" + j);
                row.put("salespersonId", salesperson.id());
                row.put("salespersonName", salesperson.name());
                row.put("customerId", customer.id());
                row.put("customerName", customer.name());
                row.put("amount", amount);
                row.put("orderCount", 1 + Math.floorMod(seed + i + j, 4));
                row.put("lastSoldAt", mockDate(seed, 15 + i * 19 + j * 11));
                salesSummary.add(row);

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", "product-performance-" + i + "-" + j);
                item.put("salespersonId", salesperson.id());
                item.put("salespersonName", salesperson.name());
                item.put("customerId", customer.id());
                item.put("customerName", customer.name());
                item.put("productId", product.getId());
                item.put("productName", product.getName());
                item.put("amount", amount);
                item.put("stage", cycle(List.of("年度签约", "重点项目", "复购扩单", "交付验收"), seed + i + j));
                item.put("happenedAt", mockDate(seed, 9 + i * 13 + j * 17));
                item.put("note", salesperson.name() + " 面向 " + customer.name() + " 推进 " + product.getName() + " 年度业务。");
                performanceItems.add(item);
            }
        }

        List<Map<String, Object>> workItems = buildProductWorkItems(product, salesRefs, customerRefs, seed);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("portalType", "PRODUCT");
        result.put("variant", "PRODUCT");
        result.put("header", buildProductHeader(product, year));
        applyScopeMetadata(result, scopeContext);
        result.put("summaryCards", List.of(
            summaryCard("salesAmount", "年度销售额", totalAmount, "元"),
            summaryCard("salespeople", "销售人数", salesRefs.size(), "人"),
            summaryCard("customers", "覆盖客户", usedCustomerIds.size(), "家"),
            summaryCard("openWork", "关联工作", countStatuses(workItems, "ACTIVE"), "项")
        ));
        result.put("salesSummary", salesSummary);
        result.put("performanceItems", performanceItems);
        result.put("workSummary", buildWorkSummary(workItems));
        result.put("workItems", workItems);
        return result;
    }

    private Map<String, Object> buildCustomerPortal(ExternalObject object, String viewerId) {
        int year = Year.now().getValue();
        CustomerPortalPerspective perspective = resolveCustomerPortalPerspective(object, viewerId);
        int seed = stableSeed(object.getId() + "#" + perspective.seedKey(), 29);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("portalType", "OBJECT");
        result.put("header", buildObjectHeader(object, year));
        List<RefItem> participantRefs = perspective.users();
        List<RefItem> productRefs = pickRefs(loadProductRefs(), 4, seed / 5 + 3);
        List<Map<String, Object>> performanceItems = new ArrayList<>();
        Map<String, BigDecimal> salesTotals = new LinkedHashMap<>();
        Map<String, Integer> salesDetailCounts = new LinkedHashMap<>();
        Map<String, Set<String>> salesProducts = new LinkedHashMap<>();
        Map<String, BigDecimal> productTotals = new LinkedHashMap<>();
        Map<String, String> productNames = new LinkedHashMap<>();
        Map<String, String> productCodes = new LinkedHashMap<>();

        for (int i = 0; i < participantRefs.size(); i++) {
            RefItem participant = participantRefs.get(i);
            int productSpan = Math.min(productRefs.size(), 1 + Math.floorMod(seed + i, Math.max(1, Math.min(3, productRefs.size()))));
            for (int j = 0; j < productSpan; j++) {
                RefItem productRef = productRefs.get((i + j) % productRefs.size());
                BigDecimal amount = money(object.getId() + "#" + perspective.seedKey(), i * 17 + j * 5 + 2, 10, 34);

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", "object-performance-" + i + "-" + j);
                item.put("salespersonId", participant.id());
                item.put("salespersonName", participant.name());
                item.put("productId", productRef.id());
                item.put("productName", productRef.name());
                item.put("productCode", productRef.meta());
                item.put("amount", amount);
                item.put("achievementType", cycle(List.of("签约", "复购", "验收", "回款"), seed + i + j));
                item.put("achievedAt", mockDate(seed, 8 + i * 19 + j * 13));
                item.put("note", participant.name() + " 以" + perspective.shortLabel() + "推进 " + object.getName() + " 的 " + productRef.name() + " 业务。");
                performanceItems.add(item);

                salesTotals.merge(refKey(participant), amount, BigDecimal::add);
                salesDetailCounts.merge(refKey(participant), 1, Integer::sum);
                salesProducts.computeIfAbsent(refKey(participant), key -> new LinkedHashSet<>()).add(refKey(productRef));

                productTotals.merge(refKey(productRef), amount, BigDecimal::add);
                productNames.put(refKey(productRef), productRef.name());
                productCodes.put(refKey(productRef), productRef.meta());
            }
        }

        List<Map<String, Object>> salesSummary = new ArrayList<>();
        for (RefItem participant : participantRefs) {
            String key = refKey(participant);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "object-sales-summary-" + key);
            row.put("salespersonId", participant.id());
            row.put("salespersonName", participant.name());
            row.put("amount", salesTotals.getOrDefault(key, BigDecimal.ZERO));
            row.put("productCount", salesProducts.getOrDefault(key, Set.of()).size());
            row.put("performanceItemCount", salesDetailCounts.getOrDefault(key, 0));
            row.put("lastActiveAt", mockDate(seed, 24 + salesSummary.size() * 9));
            salesSummary.add(row);
        }

        List<Map<String, Object>> relatedProducts = new ArrayList<>();
        for (RefItem productRef : productRefs) {
            String key = refKey(productRef);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", productRef.id());
            row.put("name", productNames.getOrDefault(key, productRef.name()));
            row.put("code", productCodes.getOrDefault(key, productRef.meta()));
            row.put("amount", productTotals.getOrDefault(key, BigDecimal.ZERO));
            relatedProducts.add(row);
        }

        List<Map<String, Object>> workItems = buildCustomerWorkItems(object, participantRefs, productRefs, seed);
        BigDecimal totalAmount = performanceItems.stream()
            .map(item -> (BigDecimal) item.get("amount"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        result.put("variant", "OBJECT_CUSTOMER");
        result.put("perspectiveMode", perspective.mode());
        result.put("perspectiveLabel", perspective.label());
        result.put("perspectiveHint", perspective.hint());
        result.put("summaryCards", List.of(
            summaryCard("performance", "年度绩效额", totalAmount, "元"),
            summaryCard("participants", perspective.summaryLabel(), participantRefs.size(), "人"),
            summaryCard("products", "相关产品", productRefs.size(), "项"),
            summaryCard("openWork", "待推进工作", countStatuses(workItems, "ACTIVE"), "项")
        ));
        result.put("salesSummary", salesSummary);
        result.put("performanceItems", performanceItems);
        result.put("relatedProducts", relatedProducts);
        result.put("workSummary", buildWorkSummary(workItems));
        result.put("workItems", workItems);
        return result;
    }

    private Map<String, Object> buildObjectPortal(ExternalObject object) {
        int year = Year.now().getValue();
        int seed = stableSeed(object.getId(), 29);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("portalType", "OBJECT");
        result.put("header", buildObjectHeader(object, year));

        List<RefItem> ownerRefs = pickRefs(loadUserRefs(), 3 + seed % 2, seed / 7 + 2);
        List<Map<String, Object>> workItems = buildExternalObjectWorkItems(object, ownerRefs, seed);
        List<Map<String, Object>> workOwnerSummary = buildWorkOwnerSummary(workItems, ownerRefs);

        result.put("variant", "OBJECT_WORK");
        result.put("summaryCards", List.of(
            summaryCard("workTotal", "关联工作", workItems.size(), "项"),
            summaryCard("active", "进行中", countStatuses(workItems, "ACTIVE"), "项"),
            summaryCard("completed", "已完成", countStatuses(workItems, "COMPLETED"), "项"),
            summaryCard("owners", "参与人员", ownerRefs.size(), "人")
        ));
        result.put("workOwnerSummary", workOwnerSummary);
        result.put("workSummary", buildWorkSummary(workItems));
        result.put("workItems", workItems);
        return result;
    }

    private CustomerPortalPerspective resolveCustomerPortalPerspective(ExternalObject object, String viewerId) {
        if (hasText(object.getOwnerId())) {
            RefItem owner = loadUserRef(object.getOwnerId());
            if (owner != null) {
                return new CustomerPortalPerspective(
                    List.of(owner),
                    "OWNER",
                    "负责人个人视角",
                    "客户门户按负责人个人门户口径组织，不再暴露 personal / department / business / system scope 切换。",
                    "负责人",
                    "负责人个人视角",
                    owner.id()
                );
            }
        }

        List<RefItem> orgFallbackRefs = loadCustomerFallbackRefs(object);
        if (!orgFallbackRefs.isEmpty()) {
            return new CustomerPortalPerspective(
                pickRefs(orgFallbackRefs, Math.min(2, orgFallbackRefs.size()), stableSeed(object.getId(), 61)),
                "ORG_FALLBACK",
                "关联组织回退视角",
                "客户未配置负责人，回退到客户所属组织内的关联岗位视角展示，仍不提供 scope 切换。",
                "关联人员",
                "组织回退视角",
                buildCustomerFallbackSeedKey(object)
            );
        }

        RefItem viewer = loadUserRef(viewerId);
        if (viewer != null) {
            return new CustomerPortalPerspective(
                List.of(viewer),
                "VIEWER_FALLBACK",
                "访问人个人回退视角",
                "客户既无负责人也无组织内关联岗位，回退到当前访问人的个人视角展示，仍不提供 scope 切换。",
                "当前视角",
                "访问人回退视角",
                viewer.id()
            );
        }

        return new CustomerPortalPerspective(
            List.of(),
            "EMPTY",
            "客户门户",
            "缺少负责人和可用关联岗位，当前门户没有可展示的负责人视角数据。",
            "关联人员",
            "客户门户",
            object.getId()
        );
    }

    private Map<String, Object> buildUserPortal(SysUser user, String requestedPositionId) {
        int year = Year.now().getValue();
        List<PortalPosition> positions = loadPortalPositions(user);
        PortalPosition activePosition = resolveActivePosition(positions, requestedPositionId);
        String effectiveRole = effectiveRole(activePosition, user.getRole());
        String variant = variantForUserRole(effectiveRole);
        int seed = stableSeed(user.getId() + "#" + Objects.toString(activePosition == null ? null : activePosition.id(), "default"), 41);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("portalType", "USER");
        List<Map<String, Object>> portalOptions = buildPortalOptions(user, positions);
        Map<String, Object> activePortal = buildPortalOption(user, activePosition);
        result.put("portalOptions", portalOptions);
        result.put("activePortal", activePortal);
        result.put("header", buildUserHeader(user, year, activePosition, effectiveRole, portalOptions, activePortal));

        if ("SALES".equals(effectiveRole)) {
            List<RefItem> customerRefs = pickRefs(loadOwnedCustomerRefs(user.getId()), 4, seed);
            List<RefItem> productRefs = pickRefs(loadProductRefs(), 4, seed / 3 + 4);
            List<Map<String, Object>> performanceItems = new ArrayList<>();
            Map<String, BigDecimal> customerTotals = new LinkedHashMap<>();
            Map<String, Integer> customerWorkCounts = new LinkedHashMap<>();
            Map<String, Set<String>> customerProducts = new LinkedHashMap<>();
            Map<String, BigDecimal> productTotals = new LinkedHashMap<>();

            for (int i = 0; i < customerRefs.size(); i++) {
                RefItem customer = customerRefs.get(i);
                int productSpan = Math.min(productRefs.size(), 1 + Math.floorMod(seed + i, Math.max(1, Math.min(3, productRefs.size()))));
                for (int j = 0; j < productSpan; j++) {
                    RefItem productRef = productRefs.get((i + j) % productRefs.size());
                    BigDecimal amount = money(user.getId(), i * 11 + j * 19 + 3, 12, 38);

                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", "user-performance-" + i + "-" + j);
                    item.put("customerId", customer.id());
                    item.put("customerName", customer.name());
                    item.put("productId", productRef.id());
                    item.put("productName", productRef.name());
                    item.put("productCode", productRef.meta());
                    item.put("amount", amount);
                    item.put("stage", cycle(List.of("商机推进", "报价确认", "合同落地", "交付验收"), seed + i + j));
                    item.put("achievedAt", mockDate(seed, 12 + i * 7 + j * 17));
                    item.put("note", user.getName() + " 推进 " + customer.name() + " 的 " + productRef.name() + " 项目。");
                    performanceItems.add(item);

                    customerTotals.merge(refKey(customer), amount, BigDecimal::add);
                    customerWorkCounts.merge(refKey(customer), 1 + Math.floorMod(seed + j, 3), Integer::sum);
                    customerProducts.computeIfAbsent(refKey(customer), key -> new LinkedHashSet<>()).add(refKey(productRef));
                    productTotals.merge(refKey(productRef), amount, BigDecimal::add);
                }
            }

            List<Map<String, Object>> customerPerformance = new ArrayList<>();
            for (RefItem customer : customerRefs) {
                String key = refKey(customer);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", customer.id());
                row.put("name", customer.name());
                row.put("amount", customerTotals.getOrDefault(key, BigDecimal.ZERO));
                row.put("productCount", customerProducts.getOrDefault(key, Set.of()).size());
                row.put("workItemCount", customerWorkCounts.getOrDefault(key, 0));
                row.put("lastActiveAt", mockDate(seed, 18 + customerPerformance.size() * 11));
                customerPerformance.add(row);
            }

            List<Map<String, Object>> relatedProducts = new ArrayList<>();
            for (RefItem productRef : productRefs) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", productRef.id());
                row.put("name", productRef.name());
                row.put("code", productRef.meta());
                row.put("amount", productTotals.getOrDefault(refKey(productRef), BigDecimal.ZERO));
                relatedProducts.add(row);
            }

            List<Map<String, Object>> workItems = buildSalesUserWorkItems(user, customerRefs, productRefs, seed);
            BigDecimal totalAmount = performanceItems.stream()
                .map(item -> (BigDecimal) item.get("amount"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            result.put("variant", variant);
            result.put("summaryCards", List.of(
                summaryCard("performance", "当前绩效", totalAmount, "元"),
                summaryCard("customers", "关联客户", customerRefs.size(), "家"),
                summaryCard("products", "关联产品", productRefs.size(), "项"),
                summaryCard("openWork", "待推进工作", countStatuses(workItems, "ACTIVE"), "项")
            ));
            result.put("customerPerformance", customerPerformance);
            result.put("performanceItems", performanceItems);
            result.put("relatedCustomers", customerPerformance);
            result.put("relatedProducts", relatedProducts);
            result.put("workSummary", buildWorkSummary(workItems));
            result.put("workItems", workItems);
            return result;
        }

        List<RefItem> objectRefs = pickRefs(loadObjectRefs(), 4, seed / 5 + 6);
        List<String> topics = workTopicsForRole(effectiveRole);
        List<Map<String, Object>> workItems = new ArrayList<>();
        for (int i = 0; i < 5 && !objectRefs.isEmpty(); i++) {
            RefItem objectRef = objectRefs.get(i % objectRefs.size());
            String status = workStatus(seed, i);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "user-work-" + i);
            row.put("title", objectRef.name() + cycle(List.of("资料校验", "流程跟进", "对账确认", "节点协调"), seed + i));
            row.put("status", status);
            row.put("stage", topics.get(i % topics.size()));
            row.put("ownerId", user.getId());
            row.put("ownerName", user.getName());
            row.put("objectId", objectRef.id());
            row.put("objectName", objectRef.name());
            row.put("productId", null);
            row.put("productName", null);
            row.put("updatedAt", mockDate(seed, 7 + i * 9));
            workItems.add(row);
        }

        List<Map<String, Object>> workBuckets = new ArrayList<>();
        for (int i = 0; i < topics.size(); i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "bucket-" + i);
            row.put("label", topics.get(i));
            row.put("count", 1 + Math.floorMod(seed + i * 3, 4));
            workBuckets.add(row);
        }

        result.put("variant", variant);
        result.put("summaryCards", List.of(
            summaryCard("workTotal", "关联工作", workItems.size(), "项"),
            summaryCard("active", "进行中", countStatuses(workItems, "ACTIVE"), "项"),
            summaryCard("completed", "已完成", countStatuses(workItems, "COMPLETED"), "项"),
            summaryCard("objects", "关联对象", objectRefs.size(), "个")
        ));
        result.put("workBuckets", workBuckets);
        result.put("workSummary", buildWorkSummary(workItems));
        result.put("workItems", workItems);
        return result;
    }

    private List<Map<String, Object>> buildProductWorkItems(Product product, List<RefItem> salesRefs, List<RefItem> customerRefs, int seed) {
        if (salesRefs.isEmpty() || customerRefs.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> topics = List.of("报价确认", "合同评审", "交付对接", "回款跟踪", "客户复盘");
        for (int i = 0; i < 5; i++) {
            RefItem salesperson = salesRefs.get(i % salesRefs.size());
            RefItem customer = customerRefs.get((i + 1) % customerRefs.size());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "product-work-" + i);
            row.put("title", customer.name() + product.getName() + topics.get(i % topics.size()));
            row.put("status", workStatus(seed, i));
            row.put("stage", topics.get(i % topics.size()));
            row.put("ownerId", salesperson.id());
            row.put("ownerName", salesperson.name());
            row.put("objectId", customer.id());
            row.put("objectName", customer.name());
            row.put("productId", product.getId());
            row.put("productName", product.getName());
            row.put("updatedAt", mockDate(seed, 5 + i * 13));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> buildCustomerWorkItems(ExternalObject object, List<RefItem> salesRefs, List<RefItem> productRefs, int seed) {
        if (salesRefs.isEmpty() || productRefs.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> topics = List.of("拜访计划", "商务澄清", "技术确认", "回款跟进", "服务复盘");
        for (int i = 0; i < 5; i++) {
            RefItem salesperson = salesRefs.get(i % salesRefs.size());
            RefItem productRef = productRefs.get((i + 1) % productRefs.size());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "customer-work-" + i);
            row.put("title", object.getName() + topics.get(i % topics.size()));
            row.put("status", workStatus(seed, i));
            row.put("stage", topics.get(i % topics.size()));
            row.put("ownerId", salesperson.id());
            row.put("ownerName", salesperson.name());
            row.put("objectId", object.getId());
            row.put("objectName", object.getName());
            row.put("productId", productRef.id());
            row.put("productName", productRef.name());
            row.put("updatedAt", mockDate(seed, 3 + i * 11));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> buildExternalObjectWorkItems(ExternalObject object, List<RefItem> ownerRefs, int seed) {
        if (ownerRefs.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> topics = workTopicsForObjectType(object.getType());
        for (int i = 0; i < 5; i++) {
            RefItem owner = ownerRefs.get(i % ownerRefs.size());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "object-work-" + i);
            row.put("title", object.getName() + topics.get(i % topics.size()));
            row.put("status", workStatus(seed, i));
            row.put("stage", topics.get(i % topics.size()));
            row.put("ownerId", owner.id());
            row.put("ownerName", owner.name());
            row.put("objectId", object.getId());
            row.put("objectName", object.getName());
            row.put("productId", null);
            row.put("productName", null);
            row.put("updatedAt", mockDate(seed, 4 + i * 10));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> buildSalesUserWorkItems(SysUser user, List<RefItem> customerRefs, List<RefItem> productRefs, int seed) {
        if (customerRefs.isEmpty() || productRefs.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> topics = List.of("客户拜访", "报价推进", "合同对齐", "回款确认", "交付复盘");
        for (int i = 0; i < 5; i++) {
            RefItem customer = customerRefs.get(i % customerRefs.size());
            RefItem productRef = productRefs.get((i + 1) % productRefs.size());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", "sales-user-work-" + i);
            row.put("title", customer.name() + topics.get(i % topics.size()));
            row.put("status", workStatus(seed, i));
            row.put("stage", topics.get(i % topics.size()));
            row.put("ownerId", user.getId());
            row.put("ownerName", user.getName());
            row.put("objectId", customer.id());
            row.put("objectName", customer.name());
            row.put("productId", productRef.id());
            row.put("productName", productRef.name());
            row.put("updatedAt", mockDate(seed, 6 + i * 12));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> buildWorkOwnerSummary(List<Map<String, Object>> workItems, List<RefItem> ownerRefs) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (RefItem owner : ownerRefs) {
            int total = 0;
            int active = 0;
            int completed = 0;
            for (Map<String, Object> workItem : workItems) {
                if (!Objects.equals(workItem.get("ownerId"), owner.id())) {
                    continue;
                }
                total++;
                if ("ACTIVE".equals(workItem.get("status"))) {
                    active++;
                }
                if ("COMPLETED".equals(workItem.get("status"))) {
                    completed++;
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", owner.id());
            row.put("ownerId", owner.id());
            row.put("ownerName", owner.name());
            row.put("totalCount", total);
            row.put("activeCount", active);
            row.put("completedCount", completed);
            rows.add(row);
        }
        return rows;
    }

    private void applyScopeMetadata(Map<String, Object> result, DataScopeService.SalesPortalScope scopeContext) {
        List<Map<String, Object>> scopeOptions = new ArrayList<>();
        for (DataScopeService.ScopeOption option : scopeContext.scopeOptions()) {
            scopeOptions.add(toScopeMap(option));
        }
        result.put("scopeOptions", scopeOptions);
        result.put("activeScope", toScopeMap(scopeContext.activeScope()));
    }

    private Map<String, Object> toScopeMap(DataScopeService.ScopeOption option) {
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("key", option.key());
        scope.put("label", option.label());
        scope.put("orgId", option.orgId());
        scope.put("orgName", option.orgName());
        scope.put("description", option.description());
        return scope;
    }

    private List<PortalPosition> loadPortalPositions(SysUser user) {
        LinkedHashMap<String, PortalPosition> positions = new LinkedHashMap<>();
        jdbc.query(
            "SELECT p.id, p.name, p.code, p.default_role, p.level, TRUE AS primary_flag " +
                "FROM sys_user su " +
                "JOIN position p ON p.id = su.primary_position_id " +
                "WHERE su.id = ? " +
                "UNION ALL " +
                "SELECT p.id, p.name, p.code, p.default_role, p.level, FALSE AS primary_flag " +
                "FROM user_position up " +
                "JOIN position p ON p.id = up.position_id " +
                "WHERE up.user_id = ? " +
                "ORDER BY primary_flag DESC, name, id",
            rs -> {
                String key = rs.getString("id");
                positions.putIfAbsent(key, new PortalPosition(
                    rs.getString("id"),
                    rs.getString("name"),
                    rs.getString("code"),
                    rs.getString("default_role"),
                    rs.getObject("level") == null ? null : rs.getInt("level"),
                    rs.getBoolean("primary_flag")
                ));
            },
            user.getId(),
            user.getId()
        );
        if (positions.isEmpty()) {
            positions.put("__default__", new PortalPosition(
                user.getPrimaryPositionId(),
                lookupName("SELECT name FROM position WHERE id = ?", user.getPrimaryPositionId()),
                null,
                null,
                null,
                true
            ));
        }
        return new ArrayList<>(positions.values());
    }

    private PortalPosition resolveActivePosition(List<PortalPosition> positions, String requestedPositionId) {
        if (requestedPositionId == null || requestedPositionId.isBlank()) {
            return positions.isEmpty() ? null : positions.get(0);
        }
        for (PortalPosition position : positions) {
            if (Objects.equals(position.id(), requestedPositionId)) {
                return position;
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该用户未绑定指定岗位");
    }

    private List<Map<String, Object>> buildPortalOptions(SysUser user, List<PortalPosition> positions) {
        List<Map<String, Object>> options = new ArrayList<>();
        for (PortalPosition position : positions) {
            options.add(buildPortalOption(user, position));
        }
        return options;
    }

    private Map<String, Object> buildPortalOption(SysUser user, PortalPosition position) {
        String effectiveRole = effectiveRole(position, user.getRole());
        Map<String, Object> option = new LinkedHashMap<>();
        option.put("positionId", position == null ? null : position.id());
        option.put("positionName", position == null ? null : position.name());
        option.put("positionCode", position == null ? null : position.code());
        option.put("primary", position != null && position.primary());
        option.put("defaultRole", position == null ? null : position.defaultRole());
        option.put("role", effectiveRole);
        option.put("level", position == null ? null : position.level());
        option.put("variant", variantForUserRole(effectiveRole));
        option.put("label", buildPortalLabel(position, effectiveRole));
        return option;
    }

    private String buildPortalLabel(PortalPosition position, String effectiveRole) {
        String portalName = "SALES".equals(effectiveRole) ? "销售门户" : "工作门户";
        if (position == null || position.name() == null || position.name().isBlank()) {
            return portalName;
        }
        return position.name() + " · " + portalName;
    }

    private String effectiveRole(PortalPosition position, String fallbackRole) {
        if (position != null && position.defaultRole() != null && !position.defaultRole().isBlank()) {
            return position.defaultRole();
        }
        String code = position == null ? "" : Objects.toString(position.code(), "");
        String name = position == null ? "" : Objects.toString(position.name(), "");
        if (code.contains("SALES") || name.contains("销售") || name.contains("商务")) {
            return "SALES";
        }
        if (fallbackRole != null && !fallbackRole.isBlank()) {
            return fallbackRole;
        }
        return "STAFF";
    }

    private String variantForUserRole(String role) {
        if ("SALES".equals(role)) {
            return "USER_SALES";
        }
        String normalized = role == null || role.isBlank() ? "STAFF" : role.replace('-', '_').toUpperCase();
        return "USER_WORK_" + normalized;
    }

    private Map<String, Object> buildProductHeader(Product product, int year) {
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("id", product.getId());
        header.put("name", product.getName());
        header.put("code", product.getCode());
        header.put("spec", product.getSpec());
        header.put("productLine", product.getProductLine());
        header.put("categoryCode", product.getCategoryCode());
        header.put("categoryLevel1", product.getCategoryLevel1());
        header.put("categoryLevel2", product.getCategoryLevel2());
        header.put("categoryLevel3", product.getCategoryLevel3());
        header.put("year", year);
        return header;
    }

    private Map<String, Object> buildObjectHeader(ExternalObject object, int year) {
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("id", object.getId());
        header.put("name", object.getName());
        header.put("type", object.getType() == null ? null : object.getType().name());
        header.put("contact", object.getContact());
        header.put("phone", object.getPhone());
        header.put("address", object.getAddress());
        header.put("remark", object.getRemark());
        header.put("industry", object.getIndustry());
        header.put("ownerId", object.getOwnerId());
        header.put("orgName", lookupName("SELECT name FROM organization WHERE id = ?", object.getOrgId()));
        header.put("deptName", lookupName("SELECT name FROM organization WHERE id = ?", object.getDeptId()));
        header.put("ownerName", lookupName("SELECT name FROM sys_user WHERE id = ?", object.getOwnerId()));
        header.put("year", year);
        return header;
    }

    private Map<String, Object> buildUserHeader(SysUser user,
                                                int year,
                                                PortalPosition activePosition,
                                                String activeRole,
                                                List<Map<String, Object>> allPositions,
                                                Map<String, Object> activePortal) {
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("id", user.getId());
        header.put("name", user.getName());
        header.put("email", user.getEmail());
        header.put("phone", user.getPhone());
        header.put("role", activeRole);
        header.put("storedRole", user.getRole());
        header.put("empNo", user.getEmpNo());
        header.put("orgName", lookupName("SELECT name FROM organization WHERE id = ?", user.getOrgId()));
        header.put("positionName", activePosition == null || activePosition.name() == null
            ? lookupName("SELECT name FROM position WHERE id = ?", user.getPrimaryPositionId())
            : activePosition.name());
        header.put("positionCode", activePosition == null ? null : activePosition.code());
        header.put("primaryPositionId", user.getPrimaryPositionId());
        header.put("primaryPositionName", lookupName("SELECT name FROM position WHERE id = ?", user.getPrimaryPositionId()));
        header.put("activePosition", activePortal);
        header.put("allPositions", allPositions);
        header.put("hiredAt", user.getHiredAt());
        header.put("year", year);
        return header;
    }

    private Map<String, Object> buildWorkSummary(List<Map<String, Object>> workItems) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", workItems.size());
        summary.put("active", countStatuses(workItems, "ACTIVE"));
        summary.put("completed", countStatuses(workItems, "COMPLETED"));
        summary.put("archived", countStatuses(workItems, "ARCHIVED"));
        summary.put("cancelled", countStatuses(workItems, "CANCELLED"));
        return summary;
    }

    private int countStatuses(List<Map<String, Object>> rows, String status) {
        int count = 0;
        for (Map<String, Object> row : rows) {
            if (status.equals(row.get("status"))) {
                count++;
            }
        }
        return count;
    }

    private Map<String, Object> summaryCard(String key, String label, Object value, String suffix) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("key", key);
        card.put("label", label);
        card.put("value", value);
        card.put("suffix", suffix);
        return card;
    }

    private String lookupName(String sql, String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        List<String> rows = jdbc.query(sql, (rs, rowNum) -> rs.getString(1), id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<RefItem> loadUserRefs() {
        List<RefItem> refs = jdbc.query(
            "SELECT id, name, COALESCE(role, '') AS meta FROM sys_user ORDER BY name, id LIMIT 12",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta"))
        );
        if (!refs.isEmpty()) {
            return refs;
        }
        return fallbackUsers();
    }

    private RefItem loadUserRef(String userId) {
        if (!hasText(userId)) {
            return null;
        }
        List<RefItem> refs = jdbc.query(
            "SELECT id, name, COALESCE(role, '') AS meta FROM sys_user WHERE id = ?",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta")),
            userId
        );
        return refs.isEmpty() ? null : refs.get(0);
    }

    private List<RefItem> loadSalesRefs(DataScopeService.SalesPortalScope scopeContext) {
        String[] userIds = scopeContext.scopeUserIds().toArray(new String[0]);
        List<RefItem> refs = jdbc.query(
            "SELECT DISTINCT su.id, su.name, COALESCE(su.role, '') AS meta " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "LEFT JOIN user_position up ON up.user_id = su.id " +
                "LEFT JOIN position p2 ON p2.id = up.position_id " +
                "WHERE su.id = ANY(?::varchar[]) " +
                "AND (su.role = 'SALES' OR p.default_role = 'SALES' OR p2.default_role = 'SALES') " +
                "ORDER BY su.name, su.id",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta")),
            (Object) userIds
        );
        if (!refs.isEmpty()) {
            return refs;
        }
        return hasAnySalesUsers() ? List.of() : fallbackSalesRefs();
    }

    private List<RefItem> loadOwnedCustomerRefs(String userId) {
        List<RefItem> refs = jdbc.query(
            "SELECT id, name, 'CUSTOMER' AS meta " +
                "FROM external_object " +
                "WHERE type = 'CUSTOMER'::object_type AND owner_id = ? " +
                "ORDER BY name, id LIMIT 16",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta")),
            userId
        );
        if (!refs.isEmpty()) {
            return refs;
        }
        return hasAnyCustomerObjects() ? List.of() : fallbackCustomers();
    }

    private List<RefItem> loadCustomerRefs(DataScopeService.SalesPortalScope scopeContext) {
        String[] userIds = scopeContext.scopeUserIds().toArray(new String[0]);
        String[] orgIds = scopeContext.scopeOrgIds().toArray(new String[0]);
        List<RefItem> refs = jdbc.query(
            "SELECT DISTINCT eo.id, eo.name, 'CUSTOMER' AS meta " +
                "FROM external_object eo " +
                "WHERE eo.type = 'CUSTOMER'::object_type " +
                "AND (eo.owner_id = ANY(?::varchar[]) OR eo.org_id = ANY(?::varchar[]) OR eo.dept_id = ANY(?::varchar[])) " +
                "ORDER BY eo.name, eo.id LIMIT 32",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta")),
            (Object) userIds,
            (Object) orgIds,
            (Object) orgIds
        );
        if (!refs.isEmpty()) {
            return refs;
        }
        return hasAnyCustomerObjects() ? List.of() : fallbackCustomers();
    }

    private List<RefItem> loadCustomerFallbackRefs(ExternalObject object) {
        List<String> orgIds = new ArrayList<>();
        if (hasText(object.getDeptId())) {
            orgIds.add(object.getDeptId());
        }
        if (hasText(object.getOrgId()) && !orgIds.contains(object.getOrgId())) {
            orgIds.add(object.getOrgId());
        }
        if (orgIds.isEmpty()) {
            return List.of();
        }
        String[] values = orgIds.toArray(new String[0]);
        return jdbc.query(
            "SELECT DISTINCT su.id, su.name, COALESCE(su.role, '') AS meta " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "LEFT JOIN user_position up ON up.user_id = su.id " +
                "LEFT JOIN position p2 ON p2.id = up.position_id " +
                "WHERE su.org_id = ANY(?::varchar[]) " +
                "AND (su.role = 'SALES' OR p.default_role = 'SALES' OR p2.default_role = 'SALES') " +
                "ORDER BY su.name, su.id LIMIT 8",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta")),
            (Object) values
        );
    }

    private List<RefItem> loadObjectRefs() {
        List<RefItem> refs = jdbc.query(
            "SELECT id, name, type::text AS meta FROM external_object ORDER BY name, id LIMIT 16",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta"))
        );
        if (!refs.isEmpty()) {
            return refs;
        }
        return fallbackObjects();
    }

    private List<RefItem> loadProductRefs() {
        List<RefItem> refs = jdbc.query(
            "SELECT id, name, COALESCE(code, '') AS meta FROM product ORDER BY code, name, id LIMIT 16",
            (rs, rowNum) -> new RefItem(rs.getString("id"), rs.getString("name"), rs.getString("meta"))
        );
        if (!refs.isEmpty()) {
            return refs;
        }
        return fallbackProducts();
    }

    private boolean hasAnySalesUsers() {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(DISTINCT su.id) " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "LEFT JOIN user_position up ON up.user_id = su.id " +
                "LEFT JOIN position p2 ON p2.id = up.position_id " +
                "WHERE su.role = 'SALES' OR p.default_role = 'SALES' OR p2.default_role = 'SALES'",
            Integer.class
        );
        return count != null && count > 0;
    }

    private boolean hasAnyCustomerObjects() {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM external_object WHERE type = 'CUSTOMER'::object_type",
            Integer.class
        );
        return count != null && count > 0;
    }

    private List<RefItem> pickRefs(List<RefItem> source, int count, int seed) {
        if (source.isEmpty()) {
            return List.of();
        }
        int size = Math.min(Math.max(count, 1), source.size());
        int start = Math.floorMod(seed, source.size());
        List<RefItem> result = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            result.add(source.get((start + i) % source.size()));
        }
        return result;
    }

    private BigDecimal money(String id, int salt, int minWan, int rangeWan) {
        int base = minWan + Math.floorMod(stableSeed(id, salt), rangeWan);
        return BigDecimal.valueOf(base).multiply(BigDecimal.valueOf(10_000L));
    }

    private int stableSeed(String value, int salt) {
        return Math.floorMod((Objects.toString(value, "") + "#" + salt).hashCode(), 1_000_000);
    }

    private String mockDate(int seed, int offset) {
        LocalDate start = LocalDate.of(Year.now().getValue(), 1, 1);
        return start.plusDays(Math.floorMod(seed + offset, 320)).toString();
    }

    private String workStatus(int seed, int index) {
        int value = Math.floorMod(seed + index * 7, 10);
        if (value <= 4) {
            return "ACTIVE";
        }
        if (value <= 7) {
            return "COMPLETED";
        }
        return value == 8 ? "ARCHIVED" : "CANCELLED";
    }

    private String cycle(List<String> values, int index) {
        return values.get(Math.floorMod(index, values.size()));
    }

    private String refKey(RefItem ref) {
        return ref.id() != null ? ref.id() : ref.name();
    }

    private String buildCustomerFallbackSeedKey(ExternalObject object) {
        List<String> parts = new ArrayList<>();
        if (hasText(object.getDeptId())) {
            parts.add(object.getDeptId());
        }
        if (hasText(object.getOrgId())) {
            parts.add(object.getOrgId());
        }
        return parts.isEmpty() ? object.getId() : String.join("#", parts);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private List<String> workTopicsForRole(String role) {
        if ("HR".equals(role)) {
            return List.of("招聘入职", "档案维护", "培训跟进", "考勤校验");
        }
        if ("FINANCE".equals(role)) {
            return List.of("回款核对", "费用复核", "付款排期", "票据确认");
        }
        if ("PURCHASE".equals(role)) {
            return List.of("询价采购", "交期跟进", "来料确认", "供应对账");
        }
        if ("TECH".equals(role)) {
            return List.of("方案输出", "技术澄清", "图纸校对", "交付支持");
        }
        return List.of("流程跟进", "资料校验", "节点协调", "支持反馈");
    }

    private List<String> workTopicsForObjectType(ObjectType type) {
        if (type == ObjectType.SUPPLIER) {
            return List.of("供应商资料复核", "采购对账", "交期确认", "到货异常处理");
        }
        if (type == ObjectType.CARRIER) {
            return List.of("运输计划确认", "承运对账", "签收反馈", "异常协调");
        }
        if (type == ObjectType.BANK) {
            return List.of("账户资料更新", "付款路径确认", "授信资料复核", "回单跟进");
        }
        if (type == ObjectType.THIRD_PARTY_PAY) {
            return List.of("通道资料核验", "结算对账", "手续费确认", "异常工单处理");
        }
        return List.of("资料确认", "协同处理", "进度跟进", "结果复盘");
    }

    private List<RefItem> fallbackSalesRefs() {
        return List.of(
            new RefItem("mock-sales-1", "周楠", "SALES"),
            new RefItem("mock-sales-2", "刘颖", "SALES"),
            new RefItem("mock-sales-3", "陈科", "SALES"),
            new RefItem("mock-sales-4", "孙洁", "SALES")
        );
    }

    private List<RefItem> fallbackUsers() {
        return List.of(
            new RefItem("mock-user-1", "李宁", "FINANCE"),
            new RefItem("mock-user-2", "王晨", "HR"),
            new RefItem("mock-user-3", "郑航", "PURCHASE"),
            new RefItem("mock-user-4", "徐可", "TECH"),
            new RefItem("mock-user-5", "周楠", "SALES")
        );
    }

    private List<RefItem> fallbackCustomers() {
        return List.of(
            new RefItem("mock-customer-1", "杭州华盛工贸", "CUSTOMER"),
            new RefItem("mock-customer-2", "宁波海川设备", "CUSTOMER"),
            new RefItem("mock-customer-3", "绍兴联智科技", "CUSTOMER"),
            new RefItem("mock-customer-4", "嘉兴启航能源", "CUSTOMER"),
            new RefItem("mock-customer-5", "温州恒远电气", "CUSTOMER")
        );
    }

    private List<RefItem> fallbackObjects() {
        return List.of(
            new RefItem("mock-object-1", "杭州华盛工贸", "CUSTOMER"),
            new RefItem("mock-object-2", "上海迅达物流", "CARRIER"),
            new RefItem("mock-object-3", "宁波金桥银行", "BANK"),
            new RefItem("mock-object-4", "浙江联创供应链", "SUPPLIER"),
            new RefItem("mock-object-5", "苏州云付通", "THIRD_PARTY_PAY")
        );
    }

    private List<RefItem> fallbackProducts() {
        return List.of(
            new RefItem("mock-product-1", "低压变频柜", "ABB-INV-1001"),
            new RefItem("mock-product-2", "成套控制箱", "ABB-PNL-2012"),
            new RefItem("mock-product-3", "智能传动单元", "INVEX-DRV-3008"),
            new RefItem("mock-product-4", "远程监控模块", "INVEX-IOT-4106")
        );
    }

    private record PortalPosition(
        String id,
        String name,
        String code,
        String defaultRole,
        Integer level,
        boolean primary
    ) {}

    private record CustomerPortalPerspective(
        List<RefItem> users,
        String mode,
        String label,
        String hint,
        String summaryLabel,
        String shortLabel,
        String seedKey
    ) {}

    private record RefItem(String id, String name, String meta) {}
}
