-- micro-office 后端管理表 SQL 文档
-- 范围：组织架构、客户（外部对象）、产品服务
-- 数据库：PostgreSQL / micro_office
-- 导出时间：2026-03-20
--
-- 说明：
-- 1) 本文档聚焦后端管理表，不包含全部业务表。
-- 2) 客户数据不单独建表，统一存放在 external_object 中，通过 type='CUSTOMER' 区分。
-- 3) 组织架构相关不仅包括 organization，还包括人员、岗位、岗位关联表。

-- ============================================================
-- 一、组织架构相关
-- ============================================================
-- 核心表：organization, sys_user, position, user_position
-- 作用：
-- - organization：组织 / 部门树
-- - sys_user：人员主表
-- - position：岗位表
-- - user_position：辅助岗位关联表

-- ============================================================
-- 二、客户 / 外部对象相关
-- ============================================================
-- 核心表：external_object
-- 权限辅助表：position_object_type, user_object_type
-- 说明：
-- - 客户：type = 'CUSTOMER'
-- - 供应商：type = 'SUPPLIER'
-- - 银行：type = 'BANK'
-- - 承运商：type = 'CARRIER'
-- - 第三方支付：type = 'THIRD_PARTY_PAY'
-- - 其他：type = 'OTHER'

-- ============================================================
-- 三、产品服务相关
-- ============================================================
-- 核心表：product_service, product_line
-- 作用：
-- - product_service：产品/服务主数据
-- - product_line：产品线字典/维度表

-- ============================================================
-- 四、相关表结构（schema-only dump）
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict 4EKuXWedaUdSeO044fIvntdetC0R09iGHPel4MkOKovngbgmsxUyt4liLQJoblT

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: external_object; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_object (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    type public.object_type NOT NULL,
    name character varying(200) NOT NULL,
    contact character varying(100),
    phone character varying(20),
    address character varying(500),
    remark text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id character varying(36),
    owner_id character varying(36),
    account_no character varying(100),
    subject_code character varying(50),
    industry character varying(100),
    dept_id character varying
);


ALTER TABLE public.external_object OWNER TO postgres;

--
-- Name: organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    parent_id character varying(36),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_role character varying(20)
);


ALTER TABLE public.organization OWNER TO postgres;

--
-- Name: position; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."position" (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    parent_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    level integer DEFAULT 99,
    default_role character varying(20)
);


ALTER TABLE public."position" OWNER TO postgres;

--
-- Name: position_object_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.position_object_type (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    position_id character varying(36) NOT NULL,
    object_type character varying(30) NOT NULL
);


ALTER TABLE public.position_object_type OWNER TO postgres;

--
-- Name: sys_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_user (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    phone character varying(20),
    email character varying(100),
    password_hash character varying(255) NOT NULL,
    org_id character varying(36),
    primary_position_id character varying(36),
    hired_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role character varying(20) DEFAULT 'STAFF'::character varying NOT NULL,
    emp_no character varying(20)
);


ALTER TABLE public.sys_user OWNER TO postgres;

--
-- Name: user_object_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_object_type (
    id character varying(36) DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(36) NOT NULL,
    object_type character varying(30) NOT NULL
);


ALTER TABLE public.user_object_type OWNER TO postgres;

--
-- Name: user_position; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_position (
    user_id character varying(36) NOT NULL,
    position_id character varying(36) NOT NULL
);


ALTER TABLE public.user_position OWNER TO postgres;

--
-- Name: external_object external_object_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_object
    ADD CONSTRAINT external_object_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: position position_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_code_key UNIQUE (code);


--
-- Name: position_object_type position_object_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_object_type
    ADD CONSTRAINT position_object_type_pkey PRIMARY KEY (id);


--
-- Name: position_object_type position_object_type_position_id_object_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_object_type
    ADD CONSTRAINT position_object_type_position_id_object_type_key UNIQUE (position_id, object_type);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (id);


--
-- Name: sys_user sys_user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_user
    ADD CONSTRAINT sys_user_email_key UNIQUE (email);


--
-- Name: sys_user sys_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_user
    ADD CONSTRAINT sys_user_pkey PRIMARY KEY (id);


--
-- Name: user_object_type user_object_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_object_type
    ADD CONSTRAINT user_object_type_pkey PRIMARY KEY (id);


--
-- Name: user_object_type user_object_type_user_id_object_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_object_type
    ADD CONSTRAINT user_object_type_user_id_object_type_key UNIQUE (user_id, object_type);


--
-- Name: user_position user_position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_position
    ADD CONSTRAINT user_position_pkey PRIMARY KEY (user_id, position_id);


--
-- Name: external_object external_object_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_object
    ADD CONSTRAINT external_object_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.organization(id);


--
-- Name: external_object external_object_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_object
    ADD CONSTRAINT external_object_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organization(id);


--
-- Name: external_object external_object_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_object
    ADD CONSTRAINT external_object_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.sys_user(id);


--
-- Name: organization organization_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.organization(id);


--
-- Name: position_object_type position_object_type_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.position_object_type
    ADD CONSTRAINT position_object_type_position_id_fkey FOREIGN KEY (position_id) REFERENCES public."position"(id) ON DELETE CASCADE;


--
-- Name: position position_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public."position"(id);


--
-- Name: sys_user sys_user_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_user
    ADD CONSTRAINT sys_user_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organization(id);


--
-- Name: sys_user sys_user_primary_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_user
    ADD CONSTRAINT sys_user_primary_position_id_fkey FOREIGN KEY (primary_position_id) REFERENCES public."position"(id);


--
-- Name: user_object_type user_object_type_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_object_type
    ADD CONSTRAINT user_object_type_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.sys_user(id) ON DELETE CASCADE;


--
-- Name: user_position user_position_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_position
    ADD CONSTRAINT user_position_position_id_fkey FOREIGN KEY (position_id) REFERENCES public."position"(id);


--
-- Name: user_position user_position_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_position
    ADD CONSTRAINT user_position_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.sys_user(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 4EKuXWedaUdSeO044fIvntdetC0R09iGHPel4MkOKovngbgmsxUyt4liLQJoblT


-- ============================================================
-- 五、常用查询示例
-- ============================================================

-- 1) 查看组织架构
SELECT * FROM organization ORDER BY parent_id NULLS FIRST, sort_order, id;

-- 2) 查看人员及所属组织/岗位
SELECT u.id, u.name, u.phone, u.role, u.org_id, u.primary_position_id
FROM sys_user u
ORDER BY u.name;

-- 3) 查看岗位
SELECT * FROM position ORDER BY code, name;

-- 4) 查看客户（external_object 中 type='CUSTOMER'）
SELECT *
FROM external_object
WHERE type = 'CUSTOMER'
ORDER BY updated_at DESC;

-- 5) 查看外部对象全部类型分布
SELECT type, COUNT(*)
FROM external_object
GROUP BY type
ORDER BY type;

-- 6) 查看产品服务
SELECT *
FROM product_service
ORDER BY code, name;

-- 7) 查看产品线
SELECT *
FROM product_line
ORDER BY sort_order, code;

-- 8) 查看岗位对象类型权限
SELECT * FROM position_object_type ORDER BY position_id, object_type;

-- 9) 查看个人对象类型权限
SELECT * FROM user_object_type ORDER BY user_id, object_type;
