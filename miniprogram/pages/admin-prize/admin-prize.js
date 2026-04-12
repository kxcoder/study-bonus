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
    wx.cloud.callFunction({
      name: 'prize',
      data: { action: 'list-all', data: {} },
    }).then((res) => {
      this.setData({
        prizes: res.result ? (res.result.prizes || []) : [],
        loading: false,
      });
    }).catch(() => {
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
    
    wx.compressImage({
      src: filePath,
      quality: 'medium',
      success: (res) => {
        const compressedPath = res.tempFilePath;
        const fs = wx.getFileSystemManager();
        
        try {
          const info = fs.getFileInfoSync(compressedPath);
          const sizeKB = info.size / 1024;
          console.log('compressed size:', sizeKB, 'KB');
          
          if (sizeKB > 100) {
            this.compressImageAgain(compressedPath);
          } else {
            this.setData({ 'formData.image': compressedPath });
            wx.hideLoading();
          }
        } catch (e) {
          this.setData({ 'formData.image': compressedPath });
          wx.hideLoading();
        }
      },
      fail: () => {
        this.setData({ 'formData.image': filePath });
        wx.hideLoading();
      },
    });
  },

  compressImageAgain(filePath) {
    wx.compressImage({
      src: filePath,
      quality: 'low',
      success: (res) => {
        this.setData({ 'formData.image': res.tempFilePath });
        wx.hideLoading();
      },
      fail: () => {
        this.setData({ 'formData.image': filePath });
        wx.hideLoading();
      },
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
      },
    });
  },

  showEditForm(e) {
    const prize = e.currentTarget.dataset.prize;
    this.setData({
      showForm: true,
      editingPrize: prize,
      formData: {
        name: prize.name,
        points_cost: prize.points_cost,
        inventory: prize.inventory,
        image: prize.image || '',
      },
    });
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