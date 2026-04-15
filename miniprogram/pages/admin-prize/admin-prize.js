Page({
  data: {
    prizes: [],
    showForm: false,
    editingPrize: null,
    formData: {
      name: '',
      points_cost: '',
      inventory: 0,
      image: '',
    },
    submitting: false,
    loading: false,
  },

  onLoad() {
    this.loadPrizes();
  },

  onShow() {
    this.loadPrizes();
  },

  loadPrizes() {
    this.setData({ loading: true });
    console.log('loadPrizes called');
    wx.cloud.callFunction({
      name: 'prize',
      data: { action: 'list-all', data: {} },
    }).then((res) => {
      console.log('loadPrizes result:', res.result ? res.result.prizes.length : 0);
      const prizes = res.result ? (res.result.prizes || []) : [];
      return this.processPrizesForDisplay(prizes);
    }).then(prizes => {
      console.log('processPrizesForDisplay done, prizes:', prizes.length);
      this.setData({ prizes: prizes, loading: false });
    }).catch(err => {
      console.error('loadPrizes error:', err);
      this.setData({ loading: false });
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.compressImage(tempFilePath);
      },
    });
  },

  compressImage(filePath) {
    wx.showLoading({ title: '压缩中...' });
    console.log('compressImage called, filePath:', filePath);
    
    wx.compressImage({
      src: filePath,
      quality: 20,
      success: (res) => {
        const compressedPath = res.tempFilePath;
        console.log('compressImage success, compressedPath:', compressedPath);
        const fs = wx.getFileSystemManager();
        
        fs.getFileInfo({
          filePath: compressedPath,
          success: (infoRes) => {
            const sizeKB = infoRes.size / 1024;
            console.log('compressed size:', sizeKB, 'KB');
            
            if (sizeKB > 10) {
              console.log('size > 10KB, compress again');
              this.compressImageAgain(compressedPath);
            } else {
              console.log('size <= 10KB, proceed to upload');
              this.uploadImage(compressedPath);
            }
          },
          fail: (err) => {
            console.error('getFileInfo error:', err);
            this.uploadImage(compressedPath);
          },
        });
      },
      fail: (err) => {
        console.error('compressImage fail:', err);
        this.uploadImage(filePath);
      },
    });
  },

  compressImageAgain(filePath) {
    wx.compressImage({
      src: filePath,
      quality: 20,
      success: (res) => {
        const compressedPath = res.tempFilePath;
        const fs = wx.getFileSystemManager();
        
        fs.getFileInfo({
          filePath: compressedPath,
          success: (infoRes) => {
            const sizeKB = infoRes.size / 1024;
            console.log('compressImageAgain size:', sizeKB, 'KB');
            
            if (sizeKB > 10) {
              this.compressImageToSize(compressedPath);
            } else {
              this.uploadImage(compressedPath);
            }
          },
          fail: () => {
            this.uploadImage(compressedPath);
          },
        });
      },
      fail: () => {
        this.uploadImage(filePath);
      },
    });
  },

  compressImageToSize(filePath, attempt = 0) {
    if (attempt >= 3) {
      console.log('max attempts reached, use current file');
      this.uploadImage(filePath);
      return;
    }
    
    wx.compressImage({
      src: filePath,
      quality: 20,
      success: (res) => {
        const compressedPath = res.tempFilePath;
        const fs = wx.getFileSystemManager();
        
        fs.getFileInfo({
          filePath: compressedPath,
          success: (infoRes) => {
            const sizeKB = infoRes.size / 1024;
            console.log(`compressImageToSize attempt ${attempt + 1}:`, sizeKB, 'KB');
            
            if (sizeKB > 10 && attempt < 2) {
              this.compressImageToSize(compressedPath, attempt + 1);
            } else {
              this.uploadImage(compressedPath);
            }
          },
          fail: () => {
            this.uploadImage(compressedPath);
          },
        });
      },
      fail: () => {
        this.uploadImage(filePath);
      },
    });
  },

  uploadImage(filePath) {
    wx.showLoading({ title: '上传中...' });
    const cloudPath = `prizes/${Date.now()}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        console.log('uploadFile success, fileID:', res.fileID);
        this.setData({ 'formData.image': res.fileID });
        
        wx.cloud.getTempFileURL({
          fileList: [res.fileID],
          success: (urlRes) => {
            if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
              this.setData({ 'formData.imageUrl': urlRes.fileList[0].tempFileURL });
            }
            wx.hideLoading();
          },
          fail: () => {
            wx.hideLoading();
          },
        });
      },
      fail: (err) => {
        console.error('uploadFile fail:', err);
        wx.showToast({ title: '上传失败', icon: 'none' });
        wx.hideLoading();
      },
    });
  },

  

  processPrizesForDisplay(prizes) {
    const promises = prizes.map((prize) => {
      if (prize.image && prize.image.startsWith('cloud://')) {
        return this.getTempFileURL(prize.image).then(url => {
          prize.imageUrl = url;
          return prize;
        }).catch(() => {
          prize.imageUrl = '';
          return prize;
        });
      } else {
        prize.imageUrl = prize.image || '';
        return Promise.resolve(prize);
      }
    });
    return Promise.all(promises);
  },

  getTempFileURL(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: (res) => {
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            resolve(res.fileList[0].tempFileURL);
          } else {
            reject(new Error('no URL'));
          }
        },
        fail: reject,
      });
    });
  },

  showAddForm() {
    this.setData({
      showForm: true,
      editingPrize: null,
      formData: {
        name: '',
        points_cost: '',
        inventory: 0,
        image: '',
        imageUrl: '',
      },
    });
  },

  selectImage(e) {
    const src = e.currentTarget.dataset.src;
    this.setData({ 'formData.image': src });
  },

  removeImage() {
    this.setData({ 'formData.image': '', 'formData.imageUrl': '' });
  },

  showEditForm(e) {
    const prize = e.currentTarget.dataset.prize;
    const formData = {
      name: prize.name,
      points_cost: prize.points_cost,
      inventory: prize.inventory,
      image: prize.image || '',
    };
    
    const data = {
      showForm: true,
      editingPrize: prize,
      formData: formData,
    };
    
    if (prize.image && prize.image.startsWith('cloud://')) {
      this.getTempFileURL(prize.image).then(url => {
        this.setData({ ...data, 'formData.imageUrl': url });
      }).catch(() => {
        this.setData({ ...data, 'formData.imageUrl': '' });
      });
    } else {
      this.setData({ ...data, 'formData.imageUrl': prize.image || '' });
    }
  },

  hideForm() {
    this.setData({ showForm: false, editingPrize: null });
  },

  bindFormInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`formData.${field}`]: value });
  },

  submitForm() {
    const { formData, editingPrize } = this.data;

    if (!formData.name || !formData.name.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    if (!formData.points_cost || formData.points_cost <= 0) {
      wx.showToast({ title: '请输入积分价格', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    const data = {
      name: formData.name.trim(),
      points_cost: parseInt(formData.points_cost, 10),
      inventory: parseInt(formData.inventory, 10) || 0,
      image: formData.image || '',
    };

    const action = editingPrize ? 'update' : 'create';
    const payload = editingPrize ? { id: editingPrize._id, ...data } : data;

    wx.cloud.callFunction({
      name: 'prize',
      data: { action: action, data: payload },
    }).then((res) => {
      this.setData({ submitting: false });
      if (res.result && res.result.ok) {
        wx.showToast({ title: editingPrize ? '更新成功' : '添加成功', icon: 'success' });
        this.hideForm();
        this.loadPrizes();
      } else {
        wx.showToast({ title: (res.result && res.result.error) || '操作失败', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ submitting: false });
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  updateInventory(e) {
    const prizeId = e.currentTarget.dataset.id;
    const oldInventory = e.currentTarget.dataset.inventory;
    const newInventory = parseInt(e.detail.value, 10);

    if (isNaN(newInventory) || newInventory === oldInventory) return;

    wx.cloud.callFunction({
      name: 'prize',
      data: { action: 'update-inventory', data: { id: prizeId, inventory: newInventory } },
    }).then((res) => {
      if (res.result && res.result.ok) {
        wx.showToast({ title: '库存已更新', icon: 'success' });
        this.loadPrizes();
      } else {
        wx.showToast({ title: '更新失败', icon: 'none' });
      }
    });
  },

  toggleStatus(e) {
    const prize = e.currentTarget.dataset.prize;
    wx.showModal({
      title: `确认${prize.is_active ? '禁用' : '启用'}`,
      content: `确定要${prize.is_active ? '禁用' : '启用'}"${prize.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'prize',
            data: { action: prize.is_active ? 'deactivate' : 'update', data: { id: prize._id, is_active: !prize.is_active } },
          }).then((result) => {
            if (result.result && result.result.ok) {
              wx.showToast({ title: '操作成功', icon: 'success' });
              this.loadPrizes();
            }
          });
        }
      },
    });
  },

  deletePrize(e) {
    const prize = e.currentTarget.dataset.prize;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${prize.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'prize',
            data: { action: 'delete', data: { id: prize._id } },
          }).then((result) => {
            wx.hideLoading();
            if (result.result && result.result.ok) {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadPrizes();
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      },
    });
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.src] });
  },

  onPullDownRefresh() {
    this.loadPrizes();
    wx.stopPullDownRefresh();
  },
});