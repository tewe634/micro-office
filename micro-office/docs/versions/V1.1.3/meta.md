# V1.1.3 Meta

来源库：`micro_office`（`127.0.0.1:5432`）  
采集时间：`2026-04-13`  
范围：工作流推荐模板相关 + 节点模板相关表结构

## mo_workflow_recommendation_packages

### 列

| column_name | data_type | nullable | default |
| --- | --- | --- | --- |
| id | text | NO |  |
| name | text | NO |  |
| scene_category | text | NO |  |
| description | text | YES |  |
| status | text | NO | `'ACTIVE'::text` |
| sort_order | integer | NO | `100` |
| tags | jsonb | NO | `'[]'::jsonb` |
| meta | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| created_by | text | YES |  |
| updated_at | timestamptz | NO | `now()` |
| updated_by | text | YES |  |
| version | integer | NO | `1` |

### 约束

- `PRIMARY KEY (id)`
- `CHECK status IN ('ACTIVE','DISABLED')`
- `CHECK btrim(name) <> ''`
- `CHECK btrim(scene_category) <> ''`
- `CHECK sort_order >= 0`
- `CHECK jsonb_typeof(tags) = 'array'`
- `CHECK jsonb_typeof(meta) = 'object'`

### 索引

- `mo_workflow_recommendation_packages_pkey` (`id`)
- `idx_mo_workflow_recommendation_packages_scene_status_sort` (`scene_category, status, sort_order`)

## mo_workflow_recommendation_package_nodes

### 列

| column_name | data_type | nullable | default |
| --- | --- | --- | --- |
| id | text | NO |  |
| package_id | text | NO |  |
| module_definition_id | text | NO |  |
| parent_package_node_id | text | YES |  |
| sort_order | integer | NO | `0` |
| display_name | text | NO |  |
| hierarchy_level | integer | NO | `0` |
| relation_type | text | NO | `'SEQUENCE'::text` |
| branch_group_key | text | YES |  |
| branch_order | integer | YES |  |
| meta | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| created_by | text | YES |  |
| updated_at | timestamptz | NO | `now()` |
| updated_by | text | YES |  |
| version | integer | NO | `1` |

### 约束

- `PRIMARY KEY (id)`
- `UNIQUE (package_id, id)`
- `FOREIGN KEY (package_id) REFERENCES mo_workflow_recommendation_packages(id) ON DELETE CASCADE`
- `FOREIGN KEY (module_definition_id) REFERENCES mo_module_definitions(id) ON DELETE RESTRICT`
- `FOREIGN KEY (package_id, parent_package_node_id) REFERENCES mo_workflow_recommendation_package_nodes(package_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`
- `CHECK btrim(display_name) <> ''`
- `CHECK hierarchy_level >= 0`
- `CHECK sort_order >= 0`
- `CHECK relation_type IN ('SEQUENCE','PARALLEL')`
- `CHECK (branch_order IS NULL OR branch_order >= 0)`
- `CHECK ((branch_group_key IS NULL AND branch_order IS NULL) OR (branch_group_key IS NOT NULL AND branch_order IS NOT NULL AND relation_type = 'PARALLEL'))`
- `CHECK (branch_group_key IS NULL OR btrim(branch_group_key) <> '')`
- `CHECK jsonb_typeof(meta) = 'object'`

### 索引

- `mo_workflow_recommendation_package_nodes_pkey` (`id`)
- `uq_mo_workflow_recommendation_package_nodes_package_id_id` (`package_id, id`)
- `idx_mo_workflow_recommendation_package_nodes_package_parent_sor` (`package_id, parent_package_node_id, sort_order`)
- `idx_mo_workflow_recommendation_package_nodes_package_branch_sor` (`package_id, branch_group_key, branch_order`) `WHERE branch_group_key IS NOT NULL`

## mo_workflow_node_recommendation_rules

### 列

| column_name | data_type | nullable | default |
| --- | --- | --- | --- |
| id | text | NO |  |
| scene_category | text | YES |  |
| current_module_definition_id | text | YES |  |
| current_node_type | mo_node_type | YES |  |
| recommended_module_definition_id | text | NO |  |
| sort_order | integer | NO | `100` |
| is_active | boolean | NO | `true` |
| rule_note | text | YES |  |
| tags | jsonb | NO | `'[]'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| created_by | text | YES |  |
| updated_at | timestamptz | NO | `now()` |
| updated_by | text | YES |  |
| version | integer | NO | `1` |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (current_module_definition_id) REFERENCES mo_module_definitions(id) ON DELETE CASCADE`
- `FOREIGN KEY (recommended_module_definition_id) REFERENCES mo_module_definitions(id) ON DELETE CASCADE`
- `UNIQUE (scene_category, current_module_definition_id, current_node_type, recommended_module_definition_id)`
- `CHECK (current_module_definition_id IS NOT NULL OR current_node_type IS NOT NULL)`
- `CHECK (scene_category IS NULL OR btrim(scene_category) <> '')`
- `CHECK sort_order >= 0`
- `CHECK jsonb_typeof(tags) = 'array'`

### 索引

- `mo_workflow_node_recommendation_rules_pkey` (`id`)
- `uq_mo_workflow_node_recommendation_rules_scope_recommended` (`scene_category, current_module_definition_id, current_node_type, recommended_module_definition_id`)
- `idx_mo_workflow_node_recommendation_rules_module_active_sort` (`current_module_definition_id, is_active, sort_order`) `WHERE current_module_definition_id IS NOT NULL`
- `idx_mo_workflow_node_recommendation_rules_type_active_sort` (`current_node_type, is_active, sort_order`) `WHERE current_module_definition_id IS NULL AND current_node_type IS NOT NULL`

## mo_module_definitions

### 列

| column_name | data_type | nullable | default |
| --- | --- | --- | --- |
| id | text | NO |  |
| source_module_id | text | YES |  |
| code | text | NO |  |
| name | text | NO |  |
| source_system | text | NO | `'BASE_DATA'::text` |
| node_type | mo_node_type | NO |  |
| is_active | boolean | NO | `true` |
| version | integer | NO | `1` |
| created_at | timestamptz | NO | `now()` |
| created_by | text | YES |  |
| updated_at | timestamptz | NO | `now()` |
| updated_by | text | YES |  |
| role_key | text | YES |  |
| position_key | text | YES |  |

### 约束

- `PRIMARY KEY (id)`
- `UNIQUE (code, version)`
- `CHECK (role_key IS NULL OR btrim(role_key) <> '')`
- `CHECK (position_key IS NULL OR btrim(position_key) <> '')`

### 索引

- `mo_module_definitions_pkey` (`id`)
- `uq_mo_module_definitions_code_version` (`code, version`)
- `idx_mo_module_definitions_node_type_active` (`node_type, is_active`)
- `idx_mo_module_definitions_source_module_id` (`source_module_id`)
- `idx_mo_module_definitions_role_key` (`role_key`) `WHERE role_key IS NOT NULL`
- `idx_mo_module_definitions_position_key` (`position_key`) `WHERE position_key IS NOT NULL`

## mo_module_fields

### 列

| column_name | data_type | nullable | default |
| --- | --- | --- | --- |
| id | text | NO |  |
| module_definition_id | text | NO |  |
| field_key | text | NO |  |
| label | text | NO |  |
| data_type | text | NO |  |
| required | boolean | NO | `false` |
| field_scope | text | NO |  |
| sort_order | integer | NO | `100` |
| schema_meta | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| created_by | text | YES |  |
| updated_at | timestamptz | NO | `now()` |
| updated_by | text | YES |  |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (module_definition_id) REFERENCES mo_module_definitions(id) ON DELETE CASCADE`
- `UNIQUE (module_definition_id, field_key, field_scope)`
- `CHECK field_scope IN ('INPUT','OUTPUT')`

### 索引

- `mo_module_fields_pkey` (`id`)
- `uq_mo_module_fields_key_scope` (`module_definition_id, field_key, field_scope`)
- `idx_mo_module_fields_module_scope_order` (`module_definition_id, field_scope, sort_order`)
