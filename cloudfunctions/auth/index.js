const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'login':
      return await handleLogin(openid, data);
    case 'password-login':
      return await handlePasswordLogin(data.username, data.password);
    case 'change-password':
      return await handleChangePassword(openid, data);
    case 'get-user':
      return await getUser(openid);
    case 'check-first-login':
      return await checkFirstLogin(openid);
    case 'create-admin':
      return await handleCreateAdmin(openid, data);
    case 'update-user':
      return await updateUser(openid, data);
    case 'list-users':
      return await listUsers(openid, data);
    case 'update-user-role':
      return await updateUserRole(openid, data);
    case 'assign-user':
      return await assignUser(openid, data);
    case 'get-admins':
      return await getAdmins(openid, data);
    default:
      return { ok: false, error: 'Unknown action' };
  }
};

async function handleLogin(openid, data) {
  try {
    const users = await db.collection('users').where({
      openid: openid,
    }).get();

    let user;
    if (users.data.length === 0) {
      await db.collection('users').add({
        data: {
          openid: openid,
          nickname: data.nickname || '用户',
          role: 'child',
          points_balance: 0,
          is_first_login: false,
          password_hash: '',
          created_at: db.serverDate(),
        },
      });
      user = {
        openid: openid,
        nickname: data.nickname || '用户',
        role: 'child',
        points_balance: 0,
        is_first_login: false,
      };
    } else {
      user = users.data[0];
    }

    return {
      ok: true,
      user: {
        openid: user.openid,
        nickname: user.nickname,
        role: user.role,
        points_balance: user.points_balance,
        is_first_login: user.is_first_login,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handlePasswordLogin(username, password) {
  try {
    const passwordHash = hashPassword(password);
    const users = await db.collection('users').where({
      _id: username,
      password_hash: passwordHash,
    }).get();

    if (users.data.length === 0) {
      return { ok: false, error: '用户名或密码错误' };
    }

    const user = users.data[0];
    return {
      ok: true,
      user: {
        openid: user.openid,
        nickname: user.nickname,
        role: user.role,
        points_balance: user.points_balance,
        is_first_login: user.is_first_login,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleChangePassword(openid, data) {
  try {
    const { oldPassword, newPassword } = data;

    const users = await db.collection('users').where({
      openid: openid,
    }).get();

    if (users.data.length === 0) {
      return { ok: false, error: '用户不存在' };
    }

    const user = users.data[0];

    if (oldPassword && user.password_hash) {
      if (!verifyPassword(oldPassword, user.password_hash)) {
        return { ok: false, error: '原密码错误' };
      }
    }

    await db.collection('users').where({
      openid: openid,
    }).update({
      data: {
        password_hash: hashPassword(newPassword),
        is_first_login: false,
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getUser(openid) {
  try {
    const users = await db.collection('users').where({
      openid: openid,
    }).get();

    if (users.data.length === 0) {
      return { ok: false, error: '用户不存在' };
    }

    const user = users.data[0];
    return {
      ok: true,
      user: {
        openid: user.openid,
        nickname: user.nickname,
        role: user.role,
        points_balance: user.points_balance,
        is_first_login: user.is_first_login,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkFirstLogin(openid) {
  try {
    const users = await db.collection('users').where({
      openid: openid,
    }).get();

    if (users.data.length === 0) {
      return { ok: true, is_first_login: false };
    }

    return {
      ok: true,
      is_first_login: users.data[0].is_first_login || false,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleCreateAdmin(openid, data) {
  try {
    const users = await db.collection('users').where({
      openid: openid,
    }).get();

    if (users.data.length === 0 || users.data[0].role !== 'super_admin') {
      return { ok: false, error: '权限不足' };
    }

    const { username, password, nickname } = data;
    await db.collection('users').add({
      data: {
        _id: username,
        openid: '',
        nickname: nickname || username,
        role: 'admin',
        points_balance: 0,
        password_hash: hashPassword(password),
        is_first_login: true,
        created_at: db.serverDate(),
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function updateUser(openid, data) {
  try {
    const updateData = {};
    if (data.nickname) updateData.nickname = data.nickname;

    if (Object.keys(updateData).length === 0) {
      return { ok: false, error: '没有要更新的内容' };
    }

    await db.collection('users').where({ openid: openid }).update({
      data: updateData,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listUsers(openid, data) {
  try {
    const currentUser = await db.collection('users').where({ openid: openid }).get();
    if (currentUser.data.length === 0 || currentUser.data[0].role !== 'super_admin') {
      return { ok: false, error: '权限不足' };
    }

    const query = {};
    if (data.role && data.role !== 'all') {
      query.role = data.role;
    }

    const pageSize = data.pageSize || 50;
    const page = data.page || 1;
    const skip = (page - 1) * pageSize;

    const countResult = await db.collection('users').where(query).count();
    const users = await db.collection('users')
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    return { ok: true, users: users.data, total: countResult.total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function updateUserRole(openid, data) {
  try {
    const currentUser = await db.collection('users').where({ openid: openid }).get();
    if (currentUser.data.length === 0 || currentUser.data[0].role !== 'super_admin') {
      return { ok: false, error: '权限不足' };
    }

    if (!data.target_openid || !data.role) {
      return { ok: false, error: '缺少参数' };
    }

    const updateData = { role: data.role };
    await db.collection('users').where({ openid: data.target_openid }).update({
      data: updateData,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function assignUser(openid, data) {
  try {
    const currentUser = await db.collection('users').where({ openid: openid }).get();
    if (currentUser.data.length === 0 || currentUser.data[0].role !== 'super_admin') {
      return { ok: false, error: '权限不足' };
    }

    if (!data.target_openid || !data.assigned_admin) {
      return { ok: false, error: '缺少参数' };
    }

    const updateData = { assigned_admin: data.assigned_admin };
    
    const targetUser = await db.collection('users').where({ openid: data.target_openid }).get();
    if (targetUser.data.length > 0) {
      updateData.assigned_at = db.serverDate();
    }

    await db.collection('users').where({ openid: data.target_openid }).update({
      data: updateData,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getAdmins(openid, data) {
  try {
    const currentUser = await db.collection('users').where({ openid: openid }).get();
    if (currentUser.data.length === 0 || currentUser.data[0].role !== 'super_admin') {
      return { ok: false, error: '权限不足' };
    }

    const admins = await db.collection('users').where(
      db.command.or([
        { role: 'admin' },
        { role: 'super_admin' }
      ])
    ).get();

    return { ok: true, admins: admins.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}