Page({
  data: {},

  onLoad() {},

  goToReview() {
    wx.navigateTo({
      url: '/pages/admin-review/admin-review',
    });
  },

  goToPrize() {
    wx.navigateTo({
      url: '/pages/admin-prize/admin-prize',
    });
  },
});
