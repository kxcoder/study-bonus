Page({
  data: {
    description: '',
    rewards: [],
    loading: false,
  },

  onLoad() {
    this.loadRewards();
  },

  inputDescription(e) {
    this.setData({ description: e.detail.value });
  },

  submitReward() {
    if (!this.data.description.trim()) {
      wx.showToast({
        title: '请描述你的成就',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    wx.cloud.callFunction({
      name: 'reward',
      data: {
        action: 'submit',
        data: {
          description: this.data.description,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({
          title: '提交成功',
          icon: 'success',
        });
        this.setData({ description: '' });
        this.loadRewards();
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

  loadRewards() {
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'reward',
      data: { action: 'list', data: {} },
    }).then((res) => {
      this.setData({
        rewards: res.result ? (res.result.rewards || []) : [],
        loading: false,
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onPullDownRefresh() {
    this.loadRewards();
    wx.stopPullDownRefresh();
  },
});