import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = process.env.MICRO_OFFICE_BASE_URL ?? 'http://127.0.0.1:8080/api';
const ADMIN_LOGIN = process.env.MICRO_OFFICE_ADMIN_LOGIN ?? '13305713391';
const ADMIN_PASSWORD = process.env.MICRO_OFFICE_ADMIN_PASSWORD ?? '123456';
const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const RUN_ID = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function log(message) {
  console.log(`[api-smoke] ${message}`);
}

function fail(message, details) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function assert(condition, message, details) {
  if (!condition) {
    fail(message, details);
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueSorted(items) {
  return [...new Set(items ?? [])].sort();
}

function sameMembers(actual, expected) {
  return JSON.stringify(uniqueSorted(actual)) === JSON.stringify(uniqueSorted(expected));
}

function expectMembers(actual, expected, label) {
  assert(sameMembers(actual, expected), `${label} mismatch`, { actual, expected });
}

function composeExec(args) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(`docker compose ${args.join(' ')} failed`, {
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  return result.stdout;
}

function quoteSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function api(method, route, { token, query, body } = {}) {
  const url = new URL(route.replace(/^\//, ''), BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method,
    headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text in error path below
  }

  assert(response.ok, `${method} ${url.pathname}${url.search} failed`, {
    status: response.status,
    body: text,
  });

  if (payload && typeof payload === 'object' && 'code' in payload) {
    assert(payload.code === 0, `${method} ${url.pathname}${url.search} returned business error`, payload);
    return payload.data;
  }

  return payload;
}

async function login(loginValue, password) {
  return api('POST', '/auth/login', {
    body: { email: loginValue, password },
  });
}

async function cleanupWorkflowArtifacts(threadIds) {
  if (!threadIds.length) return;
  const inClause = threadIds.map(quoteSql).join(', ');
  const sql = [
    `DELETE FROM comment WHERE thread_id IN (${inClause});`,
    `DELETE FROM work_node WHERE thread_id IN (${inClause});`,
    `DELETE FROM work_thread WHERE id IN (${inClause});`,
  ].join(' ');

  composeExec([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    'micro_office',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]);
}

const cleanupState = {
  threadIds: [],
  objectIds: [],
  productIds: [],
  userIds: [],
  positionIds: [],
  orgIds: [],
  rolePermissions: null,
  positionObjectTypes: null,
};

async function main() {
  log(`using ${BASE_URL}`);

  const adminLogin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
  const adminToken = adminLogin.token;
  const adminUserId = adminLogin.userId;
  assert(adminLogin.role === 'ADMIN', 'admin login did not return ADMIN role', adminLogin);

  const me = await api('GET', '/users/me', { token: adminToken });
  assert(me.id === adminUserId, 'users/me user id mismatch', { me, adminLogin });

  log('checking org endpoints');
  const orgs = await api('GET', '/orgs', { token: adminToken });
  assert(Array.isArray(orgs) && orgs.length > 0, 'org list is empty');
  const orgChart = await api('GET', '/orgs/chart', { token: adminToken });
  assert(Array.isArray(orgChart.orgs), 'org chart missing orgs');
  assert(Array.isArray(orgChart.users), 'org chart missing users');
  const parentOrg = orgs.find((org) => !org.parentId) ?? orgs[0];
  assert(parentOrg?.id, 'could not pick parent org', { orgsCount: orgs.length });

  const createdOrg = await api('POST', '/orgs', {
    token: adminToken,
    body: {
      name: `${RUN_ID} org`,
      parentId: parentOrg.id,
      sortOrder: 999999,
    },
  });
  cleanupState.orgIds.push(createdOrg.id);
  const updatedOrgName = `${RUN_ID} org updated`;
  await api('PUT', `/orgs/${createdOrg.id}`, {
    token: adminToken,
    body: {
      name: updatedOrgName,
      parentId: parentOrg.id,
      sortOrder: 999998,
    },
  });
  const orgAfterUpdate = await api('GET', `/orgs/${createdOrg.id}`, { token: adminToken });
  assert(orgAfterUpdate?.name === updatedOrgName, 'org update not visible', orgAfterUpdate);
  const childOrgs = await api('GET', `/orgs/${parentOrg.id}/children`, { token: adminToken });
  assert(Array.isArray(childOrgs), 'org children did not return a list');

  log('checking position endpoints');
  const positionListBefore = await api('GET', '/positions', { token: adminToken });
  assert(Array.isArray(positionListBefore), 'position list not returned');
  const positionPageBefore = await api('GET', '/positions/page', {
    token: adminToken,
    query: { current: 1, size: 5 },
  });
  assert(Array.isArray(positionPageBefore.records), 'position page missing records');

  const createdPosition = await api('POST', '/positions', {
    token: adminToken,
    body: {
      name: `${RUN_ID} position`,
      code: `SMOKE_${Date.now()}`,
      parentId: null,
    },
  });
  cleanupState.positionIds.push(createdPosition.id);
  const updatedPositionName = `${RUN_ID} position updated`;
  await api('PUT', `/positions/${createdPosition.id}`, {
    token: adminToken,
    body: {
      name: updatedPositionName,
      code: createdPosition.code,
      parentId: null,
    },
  });
  const fetchedPosition = await api('GET', `/positions/${createdPosition.id}`, { token: adminToken });
  assert(fetchedPosition?.name === updatedPositionName, 'position update not visible', fetchedPosition);

  log('checking auth/register + self-service endpoints');
  const registeredEmail = `${RUN_ID}@example.com`;
  const registeredPassword = 'SmokePass123!';
  const registeredPhone = `18${String(Date.now()).slice(-9)}`;
  const registeredUser = await api('POST', '/auth/register', {
    body: {
      name: `${RUN_ID} registered`,
      email: registeredEmail,
      password: registeredPassword,
      phone: registeredPhone,
      orgId: createdOrg.id,
      primaryPositionId: createdPosition.id,
    },
  });
  cleanupState.userIds.push(registeredUser.userId);
  assert(registeredUser.role === 'STAFF', 'registered user role mismatch', registeredUser);

  const registeredLogin = await login(registeredEmail, registeredPassword);
  assert(registeredLogin.userId === registeredUser.userId, 'registered login user id mismatch', {
    registeredUser,
    registeredLogin,
  });
  const registeredMe = await api('GET', '/users/me', { token: registeredLogin.token });
  assert(registeredMe.id === registeredUser.userId, 'registered users/me mismatch', registeredMe);
  const registeredLookups = await api('GET', '/users/me/lookups', { token: registeredLogin.token });
  assert(Array.isArray(registeredLookups.roles), 'registered lookups missing roles');

  log('checking user endpoints');
  const usersBefore = await api('GET', '/users', {
    token: adminToken,
    query: { orgId: createdOrg.id },
  });
  assert(Array.isArray(usersBefore), 'user list not returned');
  const userPageBefore = await api('GET', '/users/page', {
    token: adminToken,
    query: { current: 1, size: 10, orgId: createdOrg.id },
  });
  assert(Array.isArray(userPageBefore.records), 'user page missing records');

  const crudUserEmail = `${RUN_ID}-crud@example.com`;
  const crudUserCreate = await api('POST', '/users', {
    token: adminToken,
    body: {
      name: `${RUN_ID} crud`,
      email: crudUserEmail,
      phone: `17${String(Date.now() + 111).slice(-9)}`,
      password: 'CrudPass123!',
      orgId: createdOrg.id,
      primaryPositionId: createdPosition.id,
      role: 'STAFF',
    },
  });
  cleanupState.userIds.push(crudUserCreate.id);
  const crudUserId = crudUserCreate.id;
  const crudUserBeforeUpdate = await api('GET', `/users/${crudUserId}`, { token: adminToken });
  assert(crudUserBeforeUpdate?.id === crudUserId, 'created user not fetchable', crudUserBeforeUpdate);
  const crudUserUpdatedName = `${RUN_ID} crud updated`;
  await api('PUT', `/users/${crudUserId}`, {
    token: adminToken,
    body: {
      name: crudUserUpdatedName,
      phone: `16${String(Date.now() + 222).slice(-9)}`,
      password: 'CrudPass456!',
      orgId: createdOrg.id,
      primaryPositionId: createdPosition.id,
      role: 'STAFF',
      extraPositionIds: [],
    },
  });
  const crudUserAfterUpdate = await api('GET', `/users/${crudUserId}`, { token: adminToken });
  assert(crudUserAfterUpdate?.name === crudUserUpdatedName, 'user update not visible', crudUserAfterUpdate);
  const usersAfter = await api('GET', '/users', {
    token: adminToken,
    query: { orgId: createdOrg.id },
  });
  assert(usersAfter.some((user) => user.id === crudUserId), 'created user missing from list');

  log('checking object endpoints');
  const objectOrgStructure = await api('GET', '/objects/org-structure', { token: adminToken });
  assert(Array.isArray(objectOrgStructure.orgs), 'object org structure missing orgs');
  const objectDepartments = await api('GET', '/objects/departments', { token: adminToken });
  assert(Array.isArray(objectDepartments), 'object departments missing list');
  const createdObject = await api('POST', '/objects', {
    token: adminToken,
    body: {
      type: 'CUSTOMER',
      name: `${RUN_ID} customer`,
      contact: 'Smoke Contact',
      phone: '400-000-0000',
      address: 'Smoke Street',
      remark: 'created by api smoke test',
      industry: '制造业',
      ownerId: adminUserId,
    },
  });
  cleanupState.objectIds.push(createdObject.id);
  const objectList = await api('GET', '/objects', {
    token: adminToken,
    query: { type: 'CUSTOMER', name: RUN_ID },
  });
  assert(objectList.some((item) => item.id === createdObject.id), 'created object missing from list');
  const objectPage = await api('GET', '/objects/page', {
    token: adminToken,
    query: { current: 1, size: 10, type: 'CUSTOMER', name: RUN_ID },
  });
  assert(objectPage.records.some((item) => item.id === createdObject.id), 'created object missing from page');
  await api('PUT', `/objects/${createdObject.id}`, {
    token: adminToken,
    body: {
      name: `${RUN_ID} customer updated`,
      remark: 'updated by api smoke test',
      industry: '工业',
    },
  });
  const fetchedObject = await api('GET', `/objects/${createdObject.id}`, { token: adminToken });
  assert(fetchedObject?.name === `${RUN_ID} customer updated`, 'object update not visible', fetchedObject);

  log('checking product endpoints');
  const productListBefore = await api('GET', '/products', {
    token: adminToken,
    query: { current: 1, size: 10 },
  });
  assert(Array.isArray(productListBefore.records), 'product list missing records');
  const createdProduct = await api('POST', '/products', {
    token: adminToken,
    body: {
      name: `${RUN_ID} product`,
      code: `SMOKE-${Date.now()}`,
      spec: 'smoke spec',
      price: 12.34,
      productLine: 'ABB',
      categoryCode: 'SMOKE',
    },
  });
  cleanupState.productIds.push(createdProduct.id);
  await api('PUT', `/products/${createdProduct.id}`, {
    token: adminToken,
    body: {
      name: `${RUN_ID} product updated`,
      code: createdProduct.code,
      spec: 'smoke spec updated',
      price: 23.45,
      productLine: createdProduct.productLine ?? 'ABB',
      categoryCode: createdProduct.categoryCode ?? 'SMOKE',
      parentId: createdProduct.parentId ?? null,
      orgId: createdProduct.orgId ?? null,
      categoryLevel1: createdProduct.categoryLevel1 ?? null,
      categoryLevel2: createdProduct.categoryLevel2 ?? null,
      categoryLevel3: createdProduct.categoryLevel3 ?? null,
    },
  });
  const fetchedProduct = await api('GET', `/products/${createdProduct.id}`, { token: adminToken });
  assert(fetchedProduct?.name === `${RUN_ID} product updated`, 'product update not visible', fetchedProduct);

  log('checking portal endpoints');
  const userPortal = await api('GET', `/portal/users/${crudUserId}`, { token: adminToken });
  assert(userPortal?.header?.id === crudUserId, 'user portal header mismatch', userPortal);
  const objectPortal = await api('GET', `/portal/objects/${createdObject.id}`, { token: adminToken });
  assert(objectPortal?.header?.id === createdObject.id, 'object portal header mismatch', objectPortal);
  const productPortal = await api('GET', `/portal/products/${createdProduct.id}`, { token: adminToken });
  assert(productPortal?.header?.id === createdProduct.id, 'product portal header mismatch', productPortal);

  log('checking admin permission/object-type endpoints');
  cleanupState.rolePermissions = await api('GET', '/admin/permissions', { token: adminToken });
  const modifiedRolePermissions = clone(cleanupState.rolePermissions);
  const itMenus = new Set(modifiedRolePermissions.IT ?? []);
  itMenus.add('/products');
  modifiedRolePermissions.IT = [...itMenus].sort();
  await api('PUT', '/admin/permissions', {
    token: adminToken,
    body: modifiedRolePermissions,
  });
  const rolePermissionsAfterSave = await api('GET', '/admin/permissions', { token: adminToken });
  assert(rolePermissionsAfterSave.IT?.includes('/products'), 'role permissions save did not stick', rolePermissionsAfterSave);

  const initialUserMenus = await api('GET', `/admin/user-permissions/${crudUserId}`, { token: adminToken });
  expectMembers(initialUserMenus, [], 'initial user menus');
  const customMenus = ['/objects', '/products'];
  await api('PUT', `/admin/user-permissions/${crudUserId}`, {
    token: adminToken,
    body: customMenus,
  });
  const savedUserMenus = await api('GET', `/admin/user-permissions/${crudUserId}`, { token: adminToken });
  expectMembers(savedUserMenus, customMenus, 'saved user menus');
  await api('DELETE', `/admin/user-permissions/${crudUserId}`, { token: adminToken });
  const resetUserMenus = await api('GET', `/admin/user-permissions/${crudUserId}`, { token: adminToken });
  expectMembers(resetUserMenus, [], 'reset user menus');

  const initialUserObjectTypes = await api('GET', `/admin/user-object-types/${crudUserId}`, { token: adminToken });
  expectMembers(initialUserObjectTypes, [], 'initial user object types');
  const customObjectTypes = ['CUSTOMER', 'SUPPLIER'];
  await api('PUT', `/admin/user-object-types/${crudUserId}`, {
    token: adminToken,
    body: customObjectTypes,
  });
  const savedUserObjectTypes = await api('GET', `/admin/user-object-types/${crudUserId}`, { token: adminToken });
  expectMembers(savedUserObjectTypes, customObjectTypes, 'saved user object types');
  await api('DELETE', `/admin/user-object-types/${crudUserId}`, { token: adminToken });
  const resetUserObjectTypes = await api('GET', `/admin/user-object-types/${crudUserId}`, { token: adminToken });
  expectMembers(resetUserObjectTypes, [], 'reset user object types');

  cleanupState.positionObjectTypes = await api('GET', '/admin/position-object-types', { token: adminToken });
  const modifiedPositionObjectTypes = clone(cleanupState.positionObjectTypes);
  modifiedPositionObjectTypes[createdPosition.id] = ['CUSTOMER'];
  await api('PUT', '/admin/position-object-types', {
    token: adminToken,
    body: modifiedPositionObjectTypes,
  });
  const positionObjectTypesAfterSave = await api('GET', '/admin/position-object-types', { token: adminToken });
  expectMembers(positionObjectTypesAfterSave[createdPosition.id], ['CUSTOMER'], 'position object types for temp position');

  log('checking thread/node/comment/taskpool endpoints');
  const createdThread = await api('POST', '/threads', {
    token: adminToken,
    body: {
      title: `${RUN_ID} thread`,
      content: 'created by api smoke test',
      objectId: createdObject.id,
      productId: createdProduct.id,
      assignToUserId: adminUserId,
      firstNodeName: 'Smoke start',
    },
  });
  cleanupState.threadIds.push(createdThread.id);

  const threadListActive = await api('GET', '/threads', {
    token: adminToken,
    query: { status: 'ACTIVE', objectId: createdObject.id },
  });
  assert(threadListActive.some((thread) => thread.id === createdThread.id), 'created thread missing from active list');

  await api('PUT', `/threads/${createdThread.id}`, {
    token: adminToken,
    body: {
      title: `${RUN_ID} thread updated`,
      content: 'updated by api smoke test',
      objectId: createdObject.id,
      productId: createdProduct.id,
    },
  });

  const threadDetail = await api('GET', `/threads/${createdThread.id}`, { token: adminToken });
  assert(threadDetail?.title === `${RUN_ID} thread updated`, 'thread update not visible', threadDetail);
  assert(Array.isArray(threadDetail.nodes) && threadDetail.nodes.length >= 1, 'thread detail missing initial node', threadDetail);
  const initialNodeId = threadDetail.nodes[0].id;

  const nodeList = await api('GET', `/threads/${createdThread.id}/nodes`, { token: adminToken });
  assert(Array.isArray(nodeList) && nodeList.length >= 1, 'thread node list missing initial node', nodeList);
  const initialNodeDetail = await api('GET', `/nodes/${initialNodeId}`, { token: adminToken });
  assert(initialNodeDetail?.node?.id === initialNodeId, 'node detail mismatch', initialNodeDetail);

  const createdComment = await api('POST', `/threads/${createdThread.id}/comments`, {
    token: adminToken,
    body: { content: 'smoke comment' },
  });
  const listedComments = await api('GET', `/threads/${createdThread.id}/comments`, { token: adminToken });
  assert(listedComments.some((comment) => comment.id === createdComment.id), 'comment missing after create');
  await api('PUT', `/comments/${createdComment.id}`, {
    token: adminToken,
    body: { content: 'smoke comment updated' },
  });
  await api('DELETE', `/comments/${createdComment.id}`, { token: adminToken });
  const commentsAfterDelete = await api('GET', `/threads/${createdThread.id}/comments`, { token: adminToken });
  assert(!commentsAfterDelete.some((comment) => comment.id === createdComment.id), 'comment still present after delete');

  await api('POST', `/nodes/${initialNodeId}/messages`, {
    token: adminToken,
    body: { content: 'smoke node message' },
  });
  const nodeMessages = await api('GET', `/nodes/${initialNodeId}/messages`, { token: adminToken });
  assert(nodeMessages.some((message) => message.content === 'smoke node message'), 'node message missing after create', nodeMessages);

  await api('POST', `/nodes/${initialNodeId}/references`, {
    token: adminToken,
    body: {
      refType: 'PRODUCT',
      refId: createdProduct.id,
      refLabel: 'Smoke product reference',
    },
  });
  const nodeDetailWithReference = await api('GET', `/nodes/${initialNodeId}`, { token: adminToken });
  const addedReference = (nodeDetailWithReference.references ?? []).find((ref) => ref.ref_id === createdProduct.id || ref.refId === createdProduct.id);
  assert(addedReference, 'node reference missing after create', nodeDetailWithReference.references);
  await api('DELETE', `/nodes/${initialNodeId}/references/${addedReference.id}`, { token: adminToken });
  const nodeDetailWithoutReference = await api('GET', `/nodes/${initialNodeId}`, { token: adminToken });
  assert(!(nodeDetailWithoutReference.references ?? []).some((ref) => ref.id === addedReference.id), 'node reference still present after delete');

  const pooledNode = await api('PUT', `/nodes/${initialNodeId}/complete`, {
    token: adminToken,
    body: {
      nextAction: 'POOL',
      poolPositionId: createdPosition.id,
      customNodeName: 'Smoke pooled',
    },
  });
  assert(pooledNode?.poolPositionId === createdPosition.id, 'pooled node not created as expected', pooledNode);
  const pooledNodeId = pooledNode.id;

  const taskPoolBeforeClaim = await api('GET', '/taskpool', {
    token: adminToken,
    query: { positionId: createdPosition.id },
  });
  assert(taskPoolBeforeClaim.some((node) => node.id === pooledNodeId), 'pooled node missing from task pool');

  await api('POST', `/taskpool/${pooledNodeId}/claim`, { token: adminToken });
  await api('PUT', `/nodes/${pooledNodeId}/transfer`, {
    token: adminToken,
    body: { targetUserId: crudUserId },
  });
  const transferredNode = await api('GET', `/nodes/${pooledNodeId}`, { token: adminToken });
  assert(transferredNode?.node?.ownerId === crudUserId, 'node transfer did not change owner', transferredNode);
  await api('PUT', `/nodes/${pooledNodeId}/assign`, {
    token: adminToken,
    body: { assigneeId: adminUserId },
  });
  const reassignedNode = await api('GET', `/nodes/${pooledNodeId}`, { token: adminToken });
  assert(reassignedNode?.node?.ownerId === adminUserId, 'node assign did not change owner', reassignedNode);
  await api('PUT', `/nodes/${pooledNodeId}/cancel`, { token: adminToken });
  const cancelledNode = await api('GET', `/nodes/${pooledNodeId}`, { token: adminToken });
  assert(cancelledNode?.node?.status === 'CANCELLED', 'node cancel did not stick', cancelledNode);

  const manualNode = await api('POST', `/threads/${createdThread.id}/nodes`, {
    token: adminToken,
    body: {
      name: 'Smoke manual node',
      ownerId: adminUserId,
      prevNodeId: pooledNodeId,
    },
  });
  await api('PUT', `/nodes/${manualNode.id}/complete`, {
    token: adminToken,
    body: { nextAction: 'COMPLETE_TASK' },
  });
  const completedThread = await api('GET', `/threads/${createdThread.id}`, { token: adminToken });
  assert(completedThread?.status === 'COMPLETED', 'thread did not reach completed status', completedThread);
  const completedThreadList = await api('GET', '/threads', {
    token: adminToken,
    query: { status: 'COMPLETED' },
  });
  assert(completedThreadList.some((thread) => thread.id === createdThread.id), 'completed thread missing from completed list');

  log('all smoke checks passed');
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(`[api-smoke] FAILED: ${error.message}`);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  } finally {
    const cleanupErrors = [];

    try {
      if (cleanupState.rolePermissions) {
        const current = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
        await api('PUT', '/admin/permissions', {
          token: current.token,
          body: cleanupState.rolePermissions,
        });
      }
    } catch (error) {
      cleanupErrors.push(`restore role permissions: ${error.message}`);
    }

    try {
      if (cleanupState.positionObjectTypes) {
        const current = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
        await api('PUT', '/admin/position-object-types', {
          token: current.token,
          body: cleanupState.positionObjectTypes,
        });
      }
    } catch (error) {
      cleanupErrors.push(`restore position object types: ${error.message}`);
    }

    try {
      await cleanupWorkflowArtifacts(cleanupState.threadIds);
    } catch (error) {
      cleanupErrors.push(`cleanup workflow artifacts: ${error.message}`);
    }

    try {
      if (cleanupState.objectIds.length || cleanupState.productIds.length || cleanupState.userIds.length || cleanupState.positionIds.length || cleanupState.orgIds.length) {
        const current = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
        for (const objectId of [...cleanupState.objectIds].reverse()) {
          await api('DELETE', `/objects/${objectId}`, { token: current.token });
        }
        for (const productId of [...cleanupState.productIds].reverse()) {
          await api('DELETE', `/products/${productId}`, { token: current.token });
        }
        for (const userId of [...cleanupState.userIds].reverse()) {
          await api('DELETE', `/users/${userId}`, { token: current.token });
        }
        for (const positionId of [...cleanupState.positionIds].reverse()) {
          await api('DELETE', `/positions/${positionId}`, { token: current.token });
        }
        for (const orgId of [...cleanupState.orgIds].reverse()) {
          await api('DELETE', `/orgs/${orgId}`, { token: current.token });
        }
      }
    } catch (error) {
      cleanupErrors.push(`cleanup temp entities: ${error.message}`);
    }

    if (cleanupErrors.length) {
      console.error('[api-smoke] cleanup issues:');
      for (const message of cleanupErrors) {
        console.error(`- ${message}`);
      }
      if (process.exitCode == null || process.exitCode === 0) {
        process.exitCode = 1;
      }
    }
  }
}

await run();
