Page({
  data: {
    prizes: [],
    history: [],
    loading: false,
    userPoints: 0,
    frozenPoints: 0,
    currentTab: 'prizes',
    statusText: {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
    },
  },

  onLoad() {
    this.loadUserInfo();
    this.loadPrizes();
  },

  onShow() {
    if (this.data.currentTab === 'history') {
      this.loadHistory();
    }
  },

  loadUserInfo() {
    wx.cloud.callFunction({
      name: 'auth',
      data: { action: 'get-user', data: {} },
    }).then((res) => {
      if (res.result && res.result.ok) {
        const userInfo = res.result.user;
        this.setData({
          userPoints: userInfo.points_balance || 0,
          frozenPoints: userInfo.frozen_balance || 0,
        });
        const app = getApp();
        app.globalData.userInfo = userInfo;
      }
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'history') {
      this.loadHistory();
    }
  },

  loadPrizes() {
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'prize',
      data: {
        action: 'list',
      },
    }).then((res) => {
      console.log('loadPrizes result:', JSON.stringify(res.result));
      const prizes = res.result && res.result.prizes ? res.result.prizes : [];
      return this.processPrizesForDisplay(prizes);
    }).then(prizes => {
      console.log('processPrizesForDisplay done, prizes:', prizes.length);
      prizes.forEach((p, i) => console.log(`prize[${i}] ${p.name}: image=${p.image}, imageUrl=${p.imageUrl}`));
      this.setData({ prizes: prizes, loading: false });
    }).catch((err) => {
      console.error('loadPrizes error:', err);
      this.setData({ loading: false });
    });
  },

  processPrizesForDisplay(prizes) {
    const promises = prizes.map((prize) => {
      if (prize.image) {
        if (prize.image.startsWith('cloud://')) {
          return this.getTempFileURL(prize.image).then(url => {
            prize.imageUrl = url;
            return prize;
          }).catch(() => {
            prize.imageUrl = prize.image;
            return prize;
          });
        } else if (prize.image.startsWith('data:')) {
          return this.saveBase64ToTempFile(prize.image, `prize_${prize._id}`).then(tempPath => {
            prize.imageUrl = tempPath;
            return prize;
          }).catch(() => {
            prize.imageUrl = '';
            return prize;
          });
        } else {
          prize.imageUrl = prize.image;
          return Promise.resolve(prize);
        }
      } else {
        prize.imageUrl = '';
        return Promise.resolve(prize);
      }
    });
    return Promise.all(promises);
  },

  saveBase64ToTempFile(base64Data, prefix) {
    return new Promise((resolve, reject) => {
      if (!base64Data || !base64Data.startsWith('data:')) {
        reject(new Error('invalid base64'));
        return;
      }
      const fs = wx.getFileSystemManager();
      const tempFilePath = `${wx.env.USER_DATA_PATH}/${prefix || 'img'}_${Date.now()}.jpg`;
      const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = wx.base64ToArrayBuffer(base64);
      fs.writeFile({
        filePath: tempFilePath,
        data: buffer,
        encoding: 'binary',
        success: () => resolve(tempFilePath),
        fail: () => reject(new Error('write fail')),
      });
    });
  },

  getTempFileURL(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: (res) => {
          console.log('getTempFileURL result:', JSON.stringify(res));
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            resolve(res.fileList[0].tempFileURL);
          } else {
            console.log('no tempFileURL, use original as fallback');
            resolve(fileID);
          }
        },
        fail: (err) => {
          console.error('getTempFileURL fail:', err);
          resolve(fileID);
        },
      });
    });
  },

  loadHistory() {
    wx.cloud.callFunction({
      name: 'redemption',
      data: {
        action: 'list',
      },
    }).then((res) => {
      if (res.result && res.result.ok) {
        this.setData({ history: res.result.redemptions || [] });
      }
    });
  },

  redeem(e) {
    const prize = e.currentTarget.dataset.prize;
    const availablePoints = this.data.userPoints - this.data.frozenPoints;

    if (availablePoints < prize.points_cost) {
      wx.showToast({
        title: '可用积分不足',
        icon: 'none',
      });
      return;
    }

    if (prize.inventory <= 0) {
      wx.showToast({
        title: '库存不足',
        icon: 'none',
      });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确认用${prize.points_cost}积分兑换${prize.name}？\n积分将暂时冻结，等待审核。`,
      success: (res) => {
        if (res.confirm) {
          this.doRedeem(prize._id);
        }
      },
    });
  },

  doRedeem(prizeId) {
    wx.showLoading({ title: '提交中...' });

    wx.cloud.callFunction({
      name: 'redemption',
      data: {
        action: 'submit',
        data: {
          prize_id: prizeId,
        },
      },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.ok) {
        wx.showToast({
          title: '兑换申请已提交',
          icon: 'success',
        });
        this.loadUserInfo();
        this.loadPrizes();
        this.setData({ currentTab: 'history' });
        setTimeout(() => {
          this.loadHistory();
        }, 500);
      } else {
        wx.showToast({
          title: res.result && res.result.error || '提交失败',
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

  onPullDownRefresh() {
    this.loadUserInfo();
    this.loadPrizes();
    if (this.data.currentTab === 'history') {
      this.loadHistory();
    }
    wx.stopPullDownRefresh();
  },
});