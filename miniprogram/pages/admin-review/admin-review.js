Page({
  data: {
    activeType: 'reward',
    activeStatus: 'all',
    currentStatusLabel: '全部',
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已拒绝' },
    ],
    statusMap: {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
    },
    records: [],
    page: 1,
    pageSize: 20,
    hasMore: false,
    loading: false,
  },

  onLoad() {
    this.loadRecords();
  },

  onShow() {
    this.setData({ page: 1, records: [] });
    this.loadRecords();
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      activeType: type,
      page: 1,
      records: [],
    });
    this.loadRecords();
  },

  switchStatus(e) {
    const index = e.detail.value;
    const option = this.data.statusOptions[index];
    this.setData({
      activeStatus: option.value,
      currentStatusLabel: option.label,
      page: 1,
      records: [],
    });
    this.loadRecords();
  },

  loadRecords() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const action = this.data.activeType === 'reward' ? 'reward' : 'redemption';
    const listAction = this.data.activeStatus === 'pending' ? 'list-pending' : 'list-history';

    console.log('loadRecords:', action, listAction, this.data.activeStatus);

    if (listAction === 'list-pending') {
      wx.cloud.callFunction({
        name: action,
        data: { action: 'list-pending', data: {} },
      }).then((res) => {
        console.log('list-pending response:', res);
        const key = this.data.activeType === 'reward' ? 'rewards' : 'redemptions';
        this.setData({
          records: res.result ? (res.result[key] || []) : [],
          hasMore: false,
          loading: false,
        });
      }).catch((err) => {
        console.log('list-pending error:', err);
        this.setData({ loading: false });
      });
    } else {
      wx.cloud.callFunction({
        name: action,
        data: {
          action: 'list-history',
          data: {
            status: this.data.activeStatus === 'all' ? undefined : this.data.activeStatus,
            page: this.data.page,
            pageSize: this.data.pageSize,
          },
        },
      }).then((res) => {
        console.log('list-history response:', res);
        const key = this.data.activeType === 'reward' ? 'rewards' : 'redemptions';
        const newRecords = this.data.page === 1
          ? (res.result[key] || [])
          : [...this.data.records, ...(res.result[key] || [])];
        this.setData({
          records: newRecords,
          hasMore: newRecords.length < res.result.total,
          loading: false,
        });
      }).catch(() => {
        this.setData({ loading: false });
      });
    }
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    if (this.data.activeStatus === 'pending') return;
    this.setData({ page: this.data.page + 1 });
    this.loadRecords();
  },

  showActionSheet(e) {
    const item = e.currentTarget.dataset.item;
    if (item.status !== 'pending') return;

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
    wx.showModal({
      title: '批准奖励',
      content: '请输入奖励积分',
      editable: true,
      placeholderText: '输入积分',
      success: (res) => {
        if (res.confirm) {
          const points = parseInt(res.content, 10) || 10;
          if (points > 0) {
            this.doApprove(item, points);
          } else {
            wx.showToast({ title: '请输入有效积分', icon: 'none' });
          }
        }
      },
    });
  },

  doApprove(item, points) {
    const action = this.data.activeType === 'reward' ? 'reward' : 'redemption';
    
    console.log('doApprove item keys:', Object.keys(item));
    console.log('doApprove item._id:', item._id);
    console.log('doApprove item.id:', item.id);
    
    const id = item._id || item.id;
    if (!id) {
      console.log('doApprove: NO ID FOUND');
      wx.showToast({ title: 'ID不存在', icon: 'none' });
      return;
    }
    
    const payload = { id: id };

    console.log('doApprove payload:', payload);

    if (this.data.activeType === 'reward') {
      payload.points = points;
    }

    console.log('doApprove:', action, payload);

    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: action,
      data: { action: 'approve', data: payload },
    }).then((res) => {
      console.log('approve response:', res);
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({ title: '已批准', icon: 'success' });
        this.setData({ page: 1, records: [] });
        this.loadRecords();
      } else {
        console.log('approve error:', res.result);
        wx.showToast({ title: res.result?.error || '操作失败', icon: 'none' });
      }
    }).catch((err) => {
      console.log('approve catch:', err);
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
    const action = this.data.activeType === 'reward' ? 'reward' : 'redemption';

    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: action,
      data: {
        action: 'reject',
        data: { id: item._id, note: note },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({ title: '已拒绝', icon: 'success' });
        this.setData({ page: 1, records: [] });
        this.loadRecords();
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onPullDownRefresh() {
    this.setData({ page: 1, records: [] });
    this.loadRecords();
    wx.stopPullDownRefresh();
  },
});
