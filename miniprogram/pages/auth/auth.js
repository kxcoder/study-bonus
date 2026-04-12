const app = getApp();

Page({
  data: {
    isFirstLogin: false,
    username: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    loginType: 'wechat',
  },

  onLoad(options) {
    if (options.first === '1') {
      this.setData({ isFirstLogin: true });
    }
  },

  switchLoginType() {
    this.setData({
      loginType: this.data.loginType === 'wechat' ? 'password' : 'wechat',
    });
  },

  inputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  inputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  inputConfirmPassword(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  inputNickname(e) {
    this.setData({ nickname: e.detail.value });
  },

  wechatLogin() {
    wx.showLoading({ title: '登录中...' });

    wx.cloud.callFunction({
      name: 'auth',
      data: {
        action: 'login',
        data: {
          nickname: this.data.nickname || undefined,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        app.globalData.userInfo = res.result.user;
        if (res.result.user.is_first_login) {
          wx.redirectTo({
            url: '/pages/auth/auth?first=1',
          });
        } else {
          wx.switchTab({
            url: '/pages/home/home',
          });
        }
      } else {
        wx.showToast({
          title: res.result.error || '登录失败',
          icon: 'none',
        });
      }
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({
        title: '登录失败',
        icon: 'none',
      });
    });
  },

  passwordLogin() {
    if (!this.data.username || !this.data.password) {
      wx.showToast({
        title: '请输入用户名和密码',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    wx.cloud.callFunction({
      name: 'auth',
      data: {
        action: 'password-login',
        data: {
          username: this.data.username,
          password: this.data.password,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        app.globalData.userInfo = res.result.user;
        if (res.result.user.is_first_login) {
          wx.redirectTo({
            url: '/pages/auth/auth?first=1',
          });
        } else {
          wx.reLaunch({
            url: '/pages/home/home',
          });
        }
      } else {
        wx.showToast({
          title: res.result.error || '登录失败',
          icon: 'none',
        });
      }
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({
        title: '登录失败',
        icon: 'none',
      });
    });
  },

  changePassword() {
    if (!this.data.password) {
      wx.showToast({
        title: '请输入新密码',
        icon: 'none',
      });
      return;
    }

    if (this.data.password.length < 6) {
      wx.showToast({
        title: '密码至少6位',
        icon: 'none',
      });
      return;
    }

    if (this.data.password !== this.data.confirmPassword) {
      wx.showToast({
        title: '两次密码不一致',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '修改中...' });

    wx.cloud.callFunction({
      name: 'auth',
      data: {
        action: 'change-password',
        data: {
          newPassword: this.data.password,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        app.globalData.userInfo.is_first_login = false;
        wx.showToast({
          title: '修改成功',
          icon: 'success',
        });
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/home/home',
          });
        }, 1500);
      } else {
        wx.showToast({
          title: res.result.error || '修改失败',
          icon: 'none',
        });
      }
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({
        title: '修改失败',
        icon: 'none',
      });
    });
  },
});