const app = getApp();

Page({
  data: {
    userInfo: null,
    pointsBalance: 0,
    isAdmin: false,
    loading: true,
    showNicknameModal: false,
    nicknameInput: '',
    saving: false,
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        pointsBalance: app.globalData.userInfo.points_balance || 0,
        isAdmin: app.globalData.userInfo.role === 'admin' || app.globalData.userInfo.role === 'super_admin',
      });
    }
  },

  checkLogin() {
    wx.cloud.callFunction({
      name: 'auth',
      data: { action: 'get-user', data: {} },
    }).then((res) => {
      if (res.result && res.result.ok) {
        app.globalData.userInfo = res.result.user;
        this.setData({
          userInfo: res.result.user,
          pointsBalance: res.result.user.points_balance || 0,
          isAdmin: res.result.user.role === 'admin' || res.result.user.role === 'super_admin',
          loading: false,
        });

        if (res.result.user.is_first_login) {
          wx.redirectTo({ url: '/pages/auth/auth?first=1' });
        }
      } else {
        wx.redirectTo({ url: '/pages/auth/auth' });
      }
    }).catch(() => {
      wx.redirectTo({ url: '/pages/auth/auth' });
    });
  },

  editNickname() {
    this.setData({
      showNicknameModal: true,
      nicknameInput: this.data.userInfo?.nickname || '',
    });
  },

  hideNicknameModal() {
    this.setData({ showNicknameModal: false, nicknameInput: '' });
  },

  inputNickname(e) {
    this.setData({ nicknameInput: e.detail.value });
  },

  saveNickname() {
    const nickname = this.data.nicknameInput.trim();
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.cloud.callFunction({
      name: 'auth',
      data: { action: 'update-user', data: { nickname } },
    }).then((res) => {
      this.setData({ saving: false });
      if (res.result && res.result.ok) {
        wx.showToast({ title: '修改成功', icon: 'success' });
        app.globalData.userInfo.nickname = nickname;
        this.setData({ 'userInfo.nickname': nickname, showNicknameModal: false });
      } else {
        wx.showToast({ title: res.result?.error || '修改失败', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ saving: false });
      wx.showToast({ title: '修改失败', icon: 'none' });
    });
  },

  goToReward() {
    wx.navigateTo({ url: '/pages/reward/reward' });
  },

  goToPrize() {
    wx.navigateTo({ url: '/pages/prize/prize' });
  },

  goToReview() {
    wx.navigateTo({ url: '/pages/admin-review/admin-review' });
  },

  goToAdminPrize() {
    wx.navigateTo({ url: '/pages/admin-prize/admin-prize' });
  },

  goToUserManagement() {
    wx.navigateTo({ url: '/pages/admin-user/admin-user' });
  },
});