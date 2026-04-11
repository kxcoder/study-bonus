Page({
  data: {
    dashboard: null,
    pendingRewards: [],
    pendingRedemptions: [],
    activeTab: 'reward',
    loading: false,
  },

  onLoad() {
    this.loadDashboard();
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  loadDashboard() {
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'dashboard',
      },
    }).then((res) => {
      this.setData({
        dashboard: res.result.dashboard,
      });
      this.loadPendingData();
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  loadPendingData() {
    if (this.data.activeTab === 'reward') {
      wx.cloud.callFunction({
        name: 'reward',
        data: {
          action: 'list-pending',
        },
      }).then((res) => {
        this.setData({
          pendingRewards: res.result.rewards || [],
          loading: false,
        });
      }).catch(() => {
        this.setData({ loading: false });
      });
    } else {
      wx.cloud.callFunction({
        name: 'redemption',
        data: {
          action: 'list-pending',
        },
      }).then((res) => {
        this.setData({
          pendingRedemptions: res.result.redemptions || [],
          loading: false,
        });
      }).catch(() => {
        this.setData({ loading: false });
      });
    }
  },

  showActionSheet(e) {
    const item = e.currentTarget.dataset.item;
    wx.showActionSheet({
      itemList: ['批准', '拒绝'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.approve(item);
        } else {
          this.reject(item);
        }
      },
    });
  },

  approve(item) {
    let points = 10;
    if (item.points_cost) {
      points = item.points_cost;
    }

    wx.showModal({
      title: '批准',
      content: `确认批准？${item.points ? '奖励 ' + item.points + ' 积分' : ''}`,
      success: (res) => {
        if (res.confirm) {
          this.doApprove(item, points);
        }
      },
    });
  },

  doApprove(item, points) {
    const collection = this.data.activeTab === 'reward' ? 'reward' : 'redemption';
    const data = { id: item._id };

    if (this.data.activeTab === 'reward') {
      data.points = points;
    }

    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: collection,
      data: {
        action: 'approve',
        data: data,
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({ title: '已批准', icon: 'success' });
        this.loadPendingData();
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  reject(item) {
    wx.showModal({
      title: '拒绝',
      content: '请输入拒绝原因',
      editable: true,
      success: (res) => {
        if (res.confirm) {
          this.doReject(item, res.content);
        }
      },
    });
  },

  doReject(item, note) {
    const collection = this.data.activeTab === 'reward' ? 'reward' : 'redemption';

    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: collection,
      data: {
        action: 'reject',
        data: { id: item._id, note: note },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({ title: '已拒绝', icon: 'success' });
        this.loadPendingData();
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onShow() {
    this.loadDashboard();
  },

  onPullDownRefresh() {
    this.loadDashboard();
    wx.stopPullDownRefresh();
  },
});