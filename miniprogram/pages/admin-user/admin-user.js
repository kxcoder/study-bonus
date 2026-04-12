Page({
  data: {
    users: [],
    page: 1,
    pageSize: 50,
    hasMore: false,
    loading: false,
    roleOptions: [
      { value: 'all', label: '全部' },
      { value: 'child', label: '孩子' },
      { value: 'admin', label: '管理员' },
      { value: 'super_admin', label: '超级管理员' },
    ],
    roleText: {
      child: '孩子',
      admin: '管理员',
      super_admin: '超级管理员',
    },
    currentRole: 'all',
    currentRoleLabel: '全部',
    assignRoleOptions: [
      { value: 'child', label: '孩子' },
      { value: 'admin', label: '普通管理员' },
    ],
    showAssignModal: false,
    selectedUser: null,
    selectedRole: '',
    selectedRoleLabel: '',
  },

  onLoad() {
    this.loadUsers();
  },

  onShow() {
    this.setData({ page: 1, users: [] });
    this.loadUsers();
  },

  switchRole(e) {
    const index = e.detail.value;
    const option = this.data.roleOptions[index];
    this.setData({
      currentRole: option.value,
      currentRoleLabel: option.label,
      page: 1,
      users: [],
    });
    this.loadUsers();
  },

  loadUsers() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'auth',
      data: {
        action: 'list-users',
        data: {
          role: this.data.currentRole,
          page: this.data.page,
          pageSize: this.data.pageSize,
        },
      },
    }).then((res) => {
      if (res.result && res.result.ok) {
        const newUsers = res.result.users || [];
        const users = this.data.page === 1 ? newUsers : [...this.data.users, ...newUsers];
        this.setData({
          users: users,
          hasMore: newUsers.length >= this.data.pageSize,
          loading: false,
        });
      } else {
        this.setData({ loading: false });
        wx.showToast({
          title: res.result && res.result.error || '加载失败',
          icon: 'none',
        });
      }
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    this.loadUsers();
  },

  showAssignModal(e) {
    const user = e.currentTarget.dataset.user;
    let options = [
      { value: 'admin', label: '普通管理员' },
    ];
    if (user.role !== 'child') {
      options.unshift({ value: 'child', label: '孩子' });
    }
    this.setData({
      showAssignModal: true,
      selectedUser: user,
      assignRoleOptions: options,
      selectedRole: options[0].value,
      selectedRoleLabel: options[0].label,
    });
  },

  hideAssignModal() {
    this.setData({
      showAssignModal: false,
      selectedUser: null,
      selectedRole: '',
      selectedRoleLabel: '',
    });
  },

  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    const label = e.currentTarget.dataset.label;
    this.setData({
      selectedRole: role,
      selectedRoleLabel: label,
    });
  },

  submitAssign() {
    if (!this.data.selectedUser || !this.data.selectedRole) {
      wx.showToast({ title: '请选择角色', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '分配中...' });

    wx.cloud.callFunction({
      name: 'auth',
      data: {
        action: 'update-user-role',
        data: {
          target_openid: this.data.selectedUser.openid,
          role: this.data.selectedRole,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({ title: '分配成功', icon: 'success' });
        this.hideAssignModal();
        this.setData({ page: 1, users: [] });
        this.loadUsers();
      } else {
        wx.showToast({
          title: res.result && res.result.error || '分配失败',
          icon: 'none',
        });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '分配失败', icon: 'none' });
    });
  },

  onPullDownRefresh() {
    this.setData({ page: 1, users: [] });
    this.loadUsers();
    wx.stopPullDownRefresh();
  },
});