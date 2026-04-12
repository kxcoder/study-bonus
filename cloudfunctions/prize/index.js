const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  console.log('prize event:', JSON.stringify(event));
  const { action, data } = event;

  switch (action) {
    case 'list':
      return await listPrizes(data);
    case 'list-all':
      return await listAllPrizes(data);
    case 'get':
      return await getPrize(data && data.id);
    case 'create':
      return await createPrize(data || event);
    case 'update':
      return await updatePrize(data && data.id, data || event);
    case 'update-inventory':
      return await updateInventory(data && data.id, data || event);
    case 'deactivate':
      return await deactivatePrize(data && data.id);
    case 'delete':
      return await deletePrize(data && data.id);
    default:
      return { ok: false, error: 'Unknown action' };
  }
};

async function listPrizes(data) {
  try {
    let query = { is_active: true };

    const prizes = await db.collection('prizes').where(query).get();

    return { ok: true, prizes: prizes.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getPrize(id) {
  try {
    const prizes = await db.collection('prizes').doc(id).get();

    if (!prizes.data) {
      return { ok: false, error: '奖品不存在' };
    }

    return { ok: true, prize: prizes.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function createPrize(data) {
  try {
    const result = await db.collection('prizes').add({
      data: {
        name: data.name,
        points_cost: data.points_cost,
        inventory: data.inventory || 0,
        image: data.image || '',
        is_active: true,
        created_at: db.serverDate(),
      },
    });

    return { ok: true, id: result._id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function updatePrize(id, data) {
  try {
    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.points_cost) updateData.points_cost = data.points_cost;
    if (data.inventory !== undefined) updateData.inventory = data.inventory;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    await db.collection('prizes').doc(id).update({
      data: updateData,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function deactivatePrize(id) {
  try {
    await db.collection('prizes').doc(id).update({
      data: {
        is_active: false,
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function listAllPrizes(data) {
  try {
    const pageSize = data.pageSize || 50;
    const page = data.page || 1;
    const skip = (page - 1) * pageSize;

    const countResult = await db.collection('prizes').count();
    const prizes = await db.collection('prizes')
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    return { ok: true, prizes: prizes.data, total: countResult.total };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function updateInventory(id, data) {
  try {
    await db.collection('prizes').doc(id).update({
      data: {
        inventory: data.inventory,
      },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function deletePrize(id) {
  try {
    await db.collection('prizes').doc(id).remove();

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}