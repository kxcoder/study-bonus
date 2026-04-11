const app = getApp();

Page({
  data: {
    userInfo: null,
    pointsBalance: 0,
    isAdmin: false,
    loading: true,
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
      data: {
        action: 'get-user',
      },
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
          wx.redirectTo({
            url: '/pages/auth/auth?first=1',
          });
        }
      } else {
        wx.redirectTo({
          url: '/pages/auth/auth',
        });
      }
    }).catch(() => {
      wx.redirectTo({
        url: '/pages/auth/auth',
      });
    });
  },

  goToReward() {
    wx.navigateTo({
      url: '/pages/reward/reward',
    });
  },

  goToPrize() {
    wx.navigateTo({
      url: '/pages/prize/prize',
    });
  },

  goToAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin',
    });
  },
});