const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'submit':
      return await submitReward(openid, data);
    case 'list':
      return await listRewards(openid);
    case 'list-pending':
      return await listPendingRewards();
    case 'approve':
      return await approveReward(data.id, data.points, data.note);
    case 'reject':
      return await rejectReward(data.id, data.note);
    default:
      return { ok: false, error: 'Unknown action' };
  }
};

async function submitReward(openid, data) {
  try {
    if (!data.description || data.description.trim() === '') {
      return { ok: false, error: '描述不能为空' };
    }

    const result = await db.collection('reward_applications').add({
      data: {
        user_id: openid,
        description: data.description,
        status: 'pending',
        points: 0,
        admin_note: '',
        created_at: db.serverDate(),
        reviewed_at: null,
      },
    });

    return { ok: true, id: result._id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listRewards(openid) {
  try {
    const rewards = await db.collection('reward_applications').where({
      user_id: openid,
    }).orderBy('created_at', 'desc').get();

    return { ok: true, rewards: rewards.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listPendingRewards() {
  try {
    const rewards = await db.collection('reward_applications').where({
      status: 'pending',
    }).orderBy('created_at', 'asc').get();

    for (let reward of rewards.data) {
      const users = await db.collection('users').where({
        openid: reward.user_id,
      }).get();
      if (users.data.length > 0) {
        reward.user = users.data[0];
      }
    }

    return { ok: true, rewards: rewards.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function approveReward(id, points, note) {
  try {
    const rewards = await db.collection('reward_applications').doc(id).get();

    if (!rewards.data[0]) {
      return { ok: false, error: '申请不存在' };
    }

    const reward = rewards.data[0];

    if (reward.status !== 'pending') {
      return { ok: false, error: '申请已被处理' };
    }

    await db.collection('reward_applications').doc(id).update({
      data: {
        status: 'approved',
        points: points,
        admin_note: note || '',
        reviewed_at: db.serverDate(),
      },
    });

    await db.collection('users').where({
      openid: reward.user_id,
    }).update({
      data: {
        points_balance: _.inc(points),
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function rejectReward(id, note) {
  try {
    const rewards = await db.collection('reward_applications').doc(id).get();

    if (!rewards.data[0]) {
      return { ok: false, error: '申请不存在' };
    }

    const reward = rewards.data[0];

    if (reward.status !== 'pending') {
      return { ok: false, error: '申请已被处理' };
    }

    await db.collection('reward_applications').doc(id).update({
      data: {
        status: 'rejected',
        admin_note: note || '',
        reviewed_at: db.serverDate(),
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}