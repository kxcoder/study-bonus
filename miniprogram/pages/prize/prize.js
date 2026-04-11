Page({
  data: {
    prizes: [],
    loading: false,
    userPoints: 0,
  },

  onLoad() {
    const app = getApp();
    this.setData({
      userPoints: app.globalData.userInfo?.points_balance || 0,
    });
    this.loadPrizes();
  },

  loadPrizes() {
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'prize',
      data: {
        action: 'list',
      },
    }).then((res) => {
      this.setData({
        prizes: res.result.prizes || [],
        loading: false,
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  redeem(e) {
    const prize = e.currentTarget.dataset.prize;

    if (this.data.userPoints < prize.points_cost) {
      wx.showToast({
        title: '积分不足',
        icon: 'none',
      });
      return;
    }

    if (prize.inventory <= 0) {
      wx.showToast({
        title: '库存不足',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确认用${prize.points_cost}积分兑换${prize.name}？`,
      success: (res) => {
        if (res.confirm) {
          this.doRedeem(prize._id);
        }
      },
    });
  },

  doRedeem(prizeId) {
    wx.showLoading({ title: '提交中...' });

    wx.cloud.callFunction({
      name: 'redemption',
      data: {
        action: 'submit',
        data: {
          prize_id: prizeId,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({
          title: '提交成功',
          icon: 'success',
        });
      } else {
        wx.showToast({
          title: res.result.error || '提交失败',
          icon: 'none',
        });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({
        title: '提交失败',
        icon: 'none',
      });
    });
  },

  onPullDownRefresh() {
    this.loadPrizes();
    wx.stopPullDownRefresh();
  },
});