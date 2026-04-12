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
    showPointsModal: false,
    currentItem: null,
    pointsInput: '',
    showRejectModal: false,
    rejectInput: '',
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

    if (this.data.activeStatus === 'all' && this.data.activeType === 'reward') {
      this.loadAllRecords();
      return;
    }

    if (!this.data.activeType) {
      this.setData({ loading: false });
      return;
    }

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

  loadAllRecords() {
    const pageSize = this.data.pageSize;
    const page = this.data.page;

    Promise.all([
      wx.cloud.callFunction({
        name: 'reward',
        data: { action: 'list-history', data: { status: undefined, page: page, pageSize: pageSize } },
      }),
      wx.cloud.callFunction({
        name: 'redemption',
        data: { action: 'list-history', data: { status: undefined, page: page, pageSize: pageSize } },
      }),
    ]).then(([rewardRes, redemptionRes]) => {
      console.log('loadAllRecords rewardRes:', rewardRes);
      console.log('loadAllRecords redemptionRes:', redemptionRes);

      const rewards = (rewardRes.result ? (rewardRes.result.rewards || []) : []).map(item => ({ ...item, recordType: 'reward' }));
      const redemptions = (redemptionRes.result ? (redemptionRes.result.redemptions || []) : []).map(item => ({ ...item, recordType: 'redemption' }));

      const combined = [...rewards, ...redemptions].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
      });

      const newRecords = this.data.page === 1
        ? combined
        : [...this.data.records, ...combined];

      const total = (rewardRes.result?.total || 0) + (redemptionRes.result?.total || 0);

      this.setData({
        records: newRecords,
        hasMore: newRecords.length < total,
        loading: false,
      });
    }).catch((err) => {
      console.log('loadAllRecords error:', err);
      this.setData({ loading: false });
    });
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    if (this.data.activeStatus === 'pending') return;
    if (this.data.activeStatus === 'all' && this.data.activeType === 'reward') return;
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
    const itemType = item.recordType || this.data.activeType;
    if (itemType === 'redemption') {
      wx.showModal({
        title: '确认批准',
        content: `确认批准该兑换申请？\n将扣除用户 ${item.points_cost || 0} 积分`,
        success: (res) => {
          if (res.confirm) {
            this.doApprove(item);
          }
        },
      });
    } else {
      this.setData({
        showPointsModal: true,
        currentItem: item,
        pointsInput: '',
      });
    }
  },

  hidePointsModal() {
    this.setData({
      showPointsModal: false,
      currentItem: null,
      pointsInput: '',
    });
  },

  bindPointsInput(e) {
    this.setData({ pointsInput: e.detail.value });
  },

  confirmPoints() {
    const input = this.data.pointsInput;
    if (!input || input.trim() === '') {
      wx.showToast({ title: '请输入积分', icon: 'none' });
      return;
    }
    const points = parseInt(input, 10);
    if (isNaN(points) || points <= 0) {
      wx.showToast({ title: '请输入有效的数字积分', icon: 'none' });
      return;
    }
    this.doApprove(this.data.currentItem, points);
  },

  doApprove(item, points) {
    const itemType = item.recordType || this.data.activeType;
    const action = itemType;
    
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

    if (itemType === 'reward') {
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
        this.setData({ page: 1, records: [], showPointsModal: false, currentItem: null, pointsInput: '' });
        this.loadRecords();
      } else {
        console.log('approve error:', res.result);
        wx.showToast({ title: (res.result && res.result.error) || '操作失败', icon: 'none' });
      }
    }).catch((err) => {
      console.log('approve catch:', err);
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  reject(item) {
    this.setData({
      showRejectModal: true,
      currentItem: item,
      rejectInput: '就是不通过',
    });
  },

  hideRejectModal() {
    this.setData({
      showRejectModal: false,
      rejectInput: '',
    });
  },

  bindRejectInput(e) {
    this.setData({ rejectInput: e.detail.value });
  },

  confirmReject() {
    const note = this.data.rejectInput || '就是不通过';
    this.doReject(this.data.currentItem, note);
  },

  doReject(item, note) {
    const itemType = item.recordType || this.data.activeType;
    const action = itemType;

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
        this.setData({ page: 1, records: [], showRejectModal: false, currentItem: null, rejectInput: '' });
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
