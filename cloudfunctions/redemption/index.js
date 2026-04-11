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
      return await submitRedemption(openid, data);
    case 'list':
      return await listRedemptions(openid);
    case 'list-pending':
      return await listPendingRedemptions();
    case 'approve':
      return await approveRedemption(data.id, data.note);
    case 'reject':
      return await rejectRedemption(data.id, data.note);
    default:
      return { ok: false, error: 'Unknown action' };
  }
};

async function submitRedemption(openid, data) {
  try {
    const users = await db.collection('users').where({
      openid: openid,
    }).get();

    if (users.data.length === 0) {
      return { ok: false, error: '用户不存在' };
    }

    const user = users.data[0];

    const prizes = await db.collection('prizes').doc(data.prize_id).get();
    if (prizes.data.length === 0) {
      return { ok: false, error: '奖品不存在' };
    }

    const prize = prizes.data[0];

    if (user.points_balance < prize.points_cost) {
      return { ok: false, error: '积分不足' };
    }

    if (prize.inventory <= 0) {
      return { ok: false, error: '奖品库存不足' };
    }

    const result = await db.collection('redemption_applications').add({
      data: {
        user_id: openid,
        prize_id: data.prize_id,
        status: 'pending',
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

async function listRedemptions(openid) {
  try {
    const redemptions = await db.collection('redemption_applications').where({
      user_id: openid,
    }).orderBy('created_at', 'desc').get();

    for (let redemption of redemptions.data) {
      const prizes = await db.collection('prizes').doc(redemption.prize_id).get();
      if (prizes.data.length > 0) {
        redemption.prize = prizes.data[0];
      }
    }

    return { ok: true, redemptions: redemptions.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listPendingRedemptions() {
  try {
    const redemptions = await db.collection('redemption_applications').where({
      status: 'pending',
    }).orderBy('created_at', 'asc').get();

    for (let redemption of redemptions.data) {
      const users = await db.collection('users').where({
        openid: redemption.user_id,
      }).get();
      if (users.data.length > 0) {
        redemption.user = users.data[0];
      }

      const prizes = await db.collection('prizes').doc(redemption.prize_id).get();
      if (prizes.data.length > 0) {
        redemption.prize = prizes.data[0];
      }
    }

    return { ok: true, redemptions: redemptions.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function approveRedemption(id, note) {
  try {
    const redemptions = await db.collection('redemption_applications').doc(id).get();

    if (!redemptions.data[0]) {
      return { ok: false, error: '申请不存在' };
    }

    const redemption = redemptions.data[0];

    if (redemption.status !== 'pending') {
      return { ok: false, error: '申请已被处理' };
    }

    const prizes = await db.collection('prizes').doc(redemption.prize_id).get();
    if (prizes.data.length === 0) {
      return { ok: false, error: '奖品不存在' };
    }

    const prize = prizes.data[0];
    const users = await db.collection('users').where({
      openid: redemption.user_id,
    }).get();

    if (users.data.length === 0) {
      return { ok: false, error: '用户不存在' };
    }

    const user = users.data[0];

    if (user.points_balance < prize.points_cost) {
      return { ok: false, error: '用户积分不足' };
    }

    await db.collection('redemption_applications').doc(id).update({
      data: {
        status: 'approved',
        admin_note: note || '',
        reviewed_at: db.serverDate(),
      },
    });

    await db.collection('users').where({
      openid: redemption.user_id,
    }).update({
      data: {
        points_balance: _.inc(-prize.points_cost),
      },
    });

    await db.collection('prizes').doc(redemption.prize_id).update({
      data: {
        inventory: _.inc(-1),
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function rejectRedemption(id, note) {
  try {
    const redemptions = await db.collection('redemption_applications').doc(id).get();

    if (!redemptions.data[0]) {
      return { ok: false, error: '申请不存在' };
    }

    const redemption = redemptions.data[0];

    if (redemption.status !== 'pending') {
      return { ok: false, error: '申请已被处理' };
    }

    await db.collection('redemption_applications').doc(id).update({
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