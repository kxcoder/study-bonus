const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, data } = event;

  switch (action) {
    case 'list':
      return await listPrizes(data);
    case 'get':
      return await getPrize(data.id);
    case 'create':
      return await createPrize(data);
    case 'update':
      return await updatePrize(data.id, data);
    case 'deactivate':
      return await deactivatePrize(data.id);
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

    if (prizes.data.length === 0) {
      return { ok: false, error: '奖品不存在' };
    }

    return { ok: true, prize: prizes.data[0] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function createPrize(data) {
  try {
    const result = await db.collection('prizes').add({
      data: {
        name: data.name,
        description: data.description || '',
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
    if (data.description !== undefined) updateData.description = data.description;
    if (data.points_cost) updateData.points_cost = data.points_cost;
    if (data.inventory !== undefined) updateData.inventory = data.inventory;
    if (data.image !== undefined) updateData.image = data.image;

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