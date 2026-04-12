const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  console.log('reward event:', JSON.stringify(event));
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('action:', action, 'data:', data);
  const eventData = data || event;
  console.log('eventData:', eventData);

  switch (action) {
    case 'submit':
      return await submitReward(openid, eventData);
    case 'list':
      return await listRewards(openid);
    case 'list-pending':
      return await listPendingRewards(openid);
    case 'list-history':
      return await listHistoryRewards(eventData, openid);
    case 'approve':
      return await approveReward(eventData.id, eventData.points, eventData.note);
    case 'reject':
      return await rejectReward(eventData.id, eventData.note);
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

async function listPendingRewards(openid) {
  try {
    let query = { status: 'pending' };
    
    if (openid) {
      const currentUser = await db.collection('users').where({ openid: openid }).get();
      
      if (currentUser.data.length > 0) {
        const role = currentUser.data[0].role;
        
        if (role === 'admin') {
          const assignedUsers = await db.collection('users').where({ assigned_admin: openid }).get();
          const userIds = assignedUsers.data.map(u => u.openid);
          
          if (userIds.length === 0) {
            return { ok: true, rewards: [] };
          }
          
          const rewards = await db.collection('reward_applications')
            .where(_.or(userIds.map(uid => ({ user_id: uid, status: 'pending' }))))
            .orderBy('created_at', 'asc')
            .get();
            
          for (let reward of rewards.data) {
            const users = await db.collection('users').where({ openid: reward.user_id }).get();
            if (users.data.length > 0) {
              reward.user = users.data[0];
            }
          }
          return { ok: true, rewards: rewards.data };
        }
      }
    }

    const rewards = await db.collection('reward_applications').where(query).orderBy('created_at', 'asc').get();

    for (let reward of rewards.data) {
      const users = await db.collection('users').where({ openid: reward.user_id }).get();
      if (users.data.length > 0) {
        reward.user = users.data[0];
      }
    }

    return { ok: true, rewards: rewards.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listHistoryRewards(data, openid) {
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
          return { ok: true, rewards: [], total: 0 };
        }
      }
    }

    const pageSize = data.pageSize || 20;
    const page = data.page || 1;
    const skip = (page - 1) * pageSize;

    const countResult = await db.collection('reward_applications').where(query).count();
    const rewards = await db.collection('reward_applications')
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    for (let reward of rewards.data) {
      const users = await db.collection('users').where({
        openid: reward.user_id,
      }).get();
      if (users.data.length > 0) {
        reward.user = users.data[0];
      }
    }

    return { ok: true, rewards: rewards.data, total: countResult.total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function approveReward(id, points, note) {
  try {
    console.log('approveReward:', id, points, note);
    const rewards = await db.collection('reward_applications').doc(id).get();
    console.log('rewards:', rewards);

    if (!rewards.data) {
      return { ok: false, error: '申请不存在' };
    }

    const reward = rewards.data;
    console.log('reward status:', reward.status);

    if (!reward || reward.status !== 'pending') {
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

    if (!rewards.data) {
      return { ok: false, error: '申请不存在' };
    }

    const reward = rewards.data;

    if (!reward || reward.status !== 'pending') {
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