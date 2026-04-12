const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  console.log('redemption event:', JSON.stringify(event));
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const eventData = data || event;

  switch (action) {
    case 'submit':
      return await submitRedemption(openid, eventData);
    case 'list':
      return await listRedemptions(openid);
    case 'list-pending':
      return await listPendingRedemptions(openid);
    case 'list-history':
      return await listHistoryRedemptions(eventData, openid);
    case 'approve':
      return await approveRedemption(eventData.id, eventData.note);
    case 'reject':
      return await rejectRedemption(eventData.id, eventData.note);
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
    if (!prizes.data) {
      return { ok: false, error: '奖品不存在' };
    }

    const prize = prizes.data;

    const frozenBalance = user.frozen_balance || 0;
    const availableBalance = user.points_balance - frozenBalance;
    if (availableBalance < prize.points_cost) {
      return { ok: false, error: '积分不足' };
    }

    if (prize.inventory <= 0) {
      return { ok: false, error: '奖品库存不足' };
    }

    const result = await db.collection('redemption_applications').add({
      data: {
        user_id: openid,
        prize_id: data.prize_id,
        prize_name: prize.name,
        points_cost: prize.points_cost,
        status: 'pending',
        admin_note: '',
        created_at: db.serverDate(),
        reviewed_at: null,
      },
    });

    await db.collection('users').where({
      openid: openid,
    }).update({
      data: {
        frozen_balance: _.inc(prize.points_cost),
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
      if (prizes.data) {
        redemption.prize = prizes.data;
      }
    }

    return { ok: true, redemptions: redemptions.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listPendingRedemptions(openid) {
  try {
    let query = { status: 'pending' };
    
    if (openid) {
      const currentUser = await db.collection('users').where({ openid: openid }).get();
      
      if (currentUser.data.length > 0 && currentUser.data[0].role === 'admin') {
        const assignedUsers = await db.collection('users').where({ assigned_admin: openid }).get();
        const userIds = assignedUsers.data.map(u => u.openid);
        
        if (userIds.length === 0) {
          return { ok: true, redemptions: [] };
        }
        
        const redemptions = await db.collection('redemption_applications')
          .where(_.or(userIds.map(uid => ({ user_id: uid, status: 'pending' }))))
          .orderBy('created_at', 'asc')
          .get();
          
        for (let redemption of redemptions.data) {
          const users = await db.collection('users').where({ openid: redemption.user_id }).get();
          if (users.data.length > 0) {
            redemption.user = users.data[0];
          }
          const prizes = await db.collection('prizes').doc(redemption.prize_id).get();
          if (prizes.data) {
            redemption.prize = prizes.data;
          }
        }
        return { ok: true, redemptions: redemptions.data };
      }
    }

    const redemptions = await db.collection('redemption_applications').where(query).orderBy('created_at', 'asc').get();

    for (let redemption of redemptions.data) {
      const users = await db.collection('users').where({ openid: redemption.user_id }).get();
      if (users.data.length > 0) {
        redemption.user = users.data[0];
      }
      const prizes = await db.collection('prizes').doc(redemption.prize_id).get();
      if (prizes.data) {
        redemption.prize = prizes.data;
      }
    }

    return { ok: true, redemptions: redemptions.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listHistoryRedemptions(data, openid) {
  try {
    let query = {};
    if (data.status && data.status !== 'all') {
      query.status = data.status;
    }

    if (openid) {
      const currentUser = await db.collection('users').where({ openid: openid }).get();
      
      if (currentUser.data.length > 0 && currentUser.data[0].role === 'admin') {
        const assignedUsers = await db.collection('users').where({ assigned_admin: openid }).get();
        const userIds = assignedUsers.data.map(u => u.openid);
        
        if (userIds.length > 0) {
          query.user_id = db.command.in(userIds);
        } else {
          return { ok: true, redemptions: [], total: 0 };
        }
      }
    }

    const pageSize = data.pageSize || 20;
    const page = data.page || 1;
    const skip = (page - 1) * pageSize;

    const countResult = await db.collection('redemption_applications').where(query).count();
    const redemptions = await db.collection('redemption_applications')
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    for (let redemption of redemptions.data) {
      const users = await db.collection('users').where({
        openid: redemption.user_id,
      }).get();
      if (users.data.length > 0) {
        redemption.user = users.data[0];
      }

      const prizes = await db.collection('prizes').doc(redemption.prize_id).get();
      if (prizes.data) {
        redemption.prize = prizes.data;
      }
    }

    return { ok: true, redemptions: redemptions.data, total: countResult.total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function approveRedemption(id, note) {
  try {
    const redemptions = await db.collection('redemption_applications').doc(id).get();

    if (!redemptions.data) {
      return { ok: false, error: '申请不存在' };
    }

    const redemption = redemptions.data;

    if (!redemption || redemption.status !== 'pending') {
      return { ok: false, error: '申请已被处理' };
    }

    const pointsCost = redemption.points_cost || 0;
    const users = await db.collection('users').where({
      openid: redemption.user_id,
    }).get();

    if (users.data.length === 0) {
      return { ok: false, error: '用户不存在' };
    }

    const user = users.data[0];
    const frozenBalance = user.frozen_balance || 0;

    if (frozenBalance < pointsCost) {
      return { ok: false, error: '冻结积分不足' };
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
        points_balance: _.inc(-pointsCost),
        frozen_balance: _.inc(-pointsCost),
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

    if (!redemptions.data) {
      return { ok: false, error: '申请不存在' };
    }

    const redemption = redemptions.data;

    if (!redemption || redemption.status !== 'pending') {
      return { ok: false, error: '申请已被处理' };
    }

    const pointsCost = redemption.points_cost || 0;

    await db.collection('redemption_applications').doc(id).update({
      data: {
        status: 'rejected',
        admin_note: note || '',
        reviewed_at: db.serverDate(),
      },
    });

    if (pointsCost > 0) {
      await db.collection('users').where({
        openid: redemption.user_id,
      }).update({
        data: {
          frozen_balance: _.inc(-pointsCost),
        },
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}