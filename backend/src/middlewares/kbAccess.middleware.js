import { ObjectId } from 'mongodb';

/**
 * KB Access Control Middleware
 * Checks if user has permission to access a KB based on:
 * - Department membership
 * - Group membership
 * - Global visibility
 * - Admin override
 */
export async function checkKBAccess(request, reply) {
    const db = request.server.db();
    const kbId = request.params.id;

    if (!kbId) {
        return reply.code(400).send({ error: 'KB ID required' });
    }

    let objectId;
    try {
        objectId = new ObjectId(kbId);
    } catch {
        return reply.code(400).send({ error: 'Invalid KB ID' });
    }

    // Get KB
    const kb = await db.collection('records').findOne({
        _id: objectId,
        tenant_id: request.tenantId
    });

    if (!kb) {
        return reply.code(404).send({ error: 'KB not found' });
    }

    // Get KB access control
    const kbAccess = await db.collection('kb_access').findOne({
        kb_id: objectId,
        tenant_id: request.tenantId
    });

    // If no access control, default to restricted (secure default)
    const visibility = kbAccess ?.visibility || 'restricted';

    // Admin and owner can see everything
    if (request.userRole === 'admin' || request.userRole === 'owner') {
        request.kb = kb;
        request.kbAccess = kbAccess;
        return;
    }

    // Global visibility - everyone can see
    if (visibility === 'global') {
        request.kb = kb;
        request.kbAccess = kbAccess;
        return;
    }

    // Restricted - check department/group access
    const userId = request.userId;

    // Get user's groups
    const userGroups = await db.collection('user_groups')
        .find({ user_id: userId, tenant_id: request.tenantId })
        .toArray();

    const userGroupIds = userGroups.map(ug => ug.group_id.toString());

    // Get departments from user's groups
    const groups = await db.collection('groups')
        .find({
            _id: { $in: userGroups.map(ug => ug.group_id) },
            tenant_id: request.tenantId
        })
        .toArray();

    const userDepartmentIds = [...new Set(groups.map(g => g.department_id.toString()))];

    // Check if user has access via department
    const allowedDepartments = (kbAccess ?.allowed_departments || []).map(d => d.toString());
    const hasDepAccess = allowedDepartments.some(deptId => userDepartmentIds.includes(deptId));

    // Check if user has access via group
    const allowedGroups = (kbAccess ?.allowed_groups || []).map(g => g.toString());
    const hasGroupAccess = allowedGroups.some(groupId => userGroupIds.includes(groupId));

    if (hasDepAccess || hasGroupAccess) {
        request.kb = kb;
        request.kbAccess = kbAccess;
        return;
    }

    // No access
    return reply.code(403).send({
        error: 'Access denied',
        message: 'You do not have permission to view this KB'
    });
}

/**
 * Check if user can edit KB
 * Must be:
 * - Admin, OR
 * - Reviewer, OR
 * - Editor AND (creator OR has group/dept access)
 */
export async function checkKBEditAccess(request, reply) {
    // First check if they can view it
    await checkKBAccess(request, reply);

    if (reply.sent) {
        return; // Access denied already sent
    }

    const kb = request.kb;
    const userRole = request.userRole;
    const userId = request.userId;

    // Admin and owner can edit everything
    if (userRole === 'admin' || userRole === 'owner') {
        return;
    }

    // Reviewer can edit everything they can see
    if (userRole === 'reviewer') {
        return;
    }

    // Editor can only edit their own KBs
    if (userRole === 'editor') {
        if (kb.created_by && kb.created_by.toString() === userId.toString()) {
            return;
        }
    }

    // Viewer cannot edit
    return reply.code(403).send({
        error: 'Access denied',
        message: 'You do not have permission to edit this KB'
    });
}

/**
 * Check if user can approve KB
 * Must be reviewer, admin or owner
 */
export async function checkKBApproveAccess(request, reply) {
    const userRole = request.userRole;

    if (!['admin', 'owner', 'reviewer'].includes(userRole)) {
        return reply.code(403).send({
            error: 'Access denied',
            message: 'Only reviewers, admins and owners can approve KBs'
        });
    }
}

/**
 * Filter KBs based on user access
 * Returns only KBs user is allowed to see
 */
export async function filterKBsByAccess(db, tenantId, userId, userRole) {

    // Admin and owner see everything
    if (userRole === 'admin' || userRole === 'owner') {
        return { tenant_id: tenantId };
    }

    // Get user's groups
    const userGroups = await db.collection('user_groups')
        .find({ user_id: userId, tenant_id: tenantId })
        .toArray();

    const userGroupIds = userGroups.map(ug => ug.group_id);

    // Get departments from user's groups
    const groups = await db.collection('groups')
        .find({
            _id: { $in: userGroupIds },
            tenant_id: tenantId
        })
        .toArray();

    const userDepartmentIds = [...new Set(groups.map(g => g.department_id))];

    // Get all KB access controls
    const kbAccesses = await db.collection('kb_access')
        .find({ tenant_id: tenantId })
        .toArray();

    // Filter accessible KB IDs
    const accessibleKBIds = [];

    for (const kbAccess of kbAccesses) {
        // Global visibility
        if (kbAccess.visibility === 'global') {
            accessibleKBIds.push(kbAccess.kb_id);
            continue;
        }

        // Check department access
        const allowedDepartments = (kbAccess.allowed_departments || []);
        const hasDepAccess = allowedDepartments.some(deptId =>
            userDepartmentIds.some(userDept => userDept.equals(deptId))
        );

        // Check group access
        const allowedGroups = (kbAccess.allowed_groups || []);
        const hasGroupAccess = allowedGroups.some(groupId =>
            userGroupIds.some(userGroup => userGroup.equals(groupId))
        );

        if (hasDepAccess || hasGroupAccess) {
            accessibleKBIds.push(kbAccess.kb_id);
        }
    }

    // Return query filter
    return {
        tenant_id: tenantId,
        _id: { $in: accessibleKBIds }
    };
}