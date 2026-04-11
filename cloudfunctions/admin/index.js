const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;

  switch (action) {
    case 'dashboard':
      return await getDashboard();
    case 'get-application':
      return await getApplication(data.type, data.id);
    case 'share-link':
      return await generateShareLink(data.type, data.id);
    case 'quick-approve':
      return await quickApprove(data.type, data.id, data.note);
    default:
      return { ok: false, error: 'Unknown action' };
  }
};

async function getDashboard() {
  try {
    const pendingRewards = await db.collection('reward_applications').where({
      status: 'pending',
    }).count();

    const pendingRedemptions = await db.collection('redemption_applications').where({
      status: 'pending',
    }).count();

    return {
      ok: true,
      dashboard: {
        pending_rewards: pendingRewards.total,
        pending_redemptions: pendingRedemptions.total,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getApplication(type, id) {
  try {
    if (type === 'reward') {
      const applications = await db.collection('reward_applications').doc(id).get();
      if (applications.data.length === 0) {
        return { ok: false, error: '申请不存在' };
      }
      const application = applications.data[0];
      const users = await db.collection('users').where({
        openid: application.user_id,
      }).get();
      if (users.data.length > 0) {
        application.user = users.data[0];
      }
      return { ok: true, application };
    } else if (type === 'redemption') {
      const applications = await db.collection('redemption_applications').doc(id).get();
      if (applications.data.length === 0) {
        return { ok: false, error: '申请不存在' };
      }
      const application = applications.data[0];
      const users = await db.collection('users').where({
        openid: application.user_id,
      }).get();
      if (users.data.length > 0) {
        application.user = users.data[0];
      }
      const prizes = await db.collection('prizes').doc(application.prize_id).get();
      if (prizes.data.length > 0) {
        application.prize = prizes.data[0];
      }
      return { ok: true, application };
    }
    return { ok: false, error: 'Invalid type' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function generateShareLink(type, id) {
  const path = `/pages/admin/review?type=${type}&id=${id}`;
  return {
    ok: true,
    path: path,
    title: `${type === 'reward' ? '奖励' : '兑换'}审核申请`,
  };
}

async function quickApprove(type, id, note) {
  try {
    if (type === 'reward') {
      const applications = await db.collection('reward_applications').doc(id).get();
      if (applications.data.length === 0) {
        return { ok: false, error: '申请不存在' };
      }
      const application = applications.data[0];
      if (application.status !== 'pending') {
        return { ok: false, error: '申请已被处理' };
      }
      await db.collection('reward_applications').doc(id).update({
        data: {
          status: 'approved',
          points: 10,
          admin_note: note || '快速批准',
          reviewed_at: db.serverDate(),
        },
      });
      await db.collection('users').where({
        openid: application.user_id,
      }).update({
        data: {
          points_balance: db.command.inc(10),
        },
      });
      return { ok: true };
    } else if (type === 'redemption') {
      const applications = await db.collection('redemption_applications').doc(id).get();
      if (applications.data.length === 0) {
        return { ok: false, error: '申请不存在' };
      }
      const application = applications.data[0];
      if (application.status !== 'pending') {
        return { ok: false, error: '申请已被处理' };
      }
      await db.collection('redemption_applications').doc(id).update({
        data: {
          status: 'approved',
          admin_note: note || '快速批准',
          reviewed_at: db.serverDate(),
        },
      });
      return { ok: true };
    }
    return { ok: false, error: 'Invalid type' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}