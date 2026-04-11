App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'pre-1guapblme2b25ae0',
        traceUser: true,
      });
    }
    this.globalData = {
      userInfo: null,
      userRole: null,
    };
  },
  globalData: {},
});