function compressImage(tempFilePath, maxSizeKB = 1) {
  return new Promise((resolve, reject) => {
    const maxSizeBytes = maxSizeKB * 1024;

    const ctx = wx.createCanvasContext('compress-canvas');
    const canvas = wx.createOffscreenCanvas || wx.createCanvas;
    
    let quality = 0.9;
    let width, height;

    wx.getImageInfo({
      src: tempFilePath,
      success: (img) => {
        width = img.width;
        height = img.height;

        const tryCompress = () => {
          const scale = Math.max(1);
          let drawWidth = width;
          let drawHeight = height;

          if (drawWidth > 200) {
            const ratio = 200 / drawWidth;
            drawWidth = 200;
            drawHeight = drawHeight * ratio;
          }

          if (drawHeight > 200) {
            const ratio = 200 / drawHeight;
            drawHeight = 200;
            drawWidth = drawWidth * ratio;
          }

          const canvasNode = canvas.createNode({
            type: '2d',
            style: {
              width: drawWidth,
              height: drawHeight,
            },
          });

          const ctx2d = canvasNode.getContext('2d');

          ctx2d.drawImage(tempFilePath, 0, 0, drawWidth, drawHeight);

          canvasNode.toTempFilePath({
            quality: quality,
            success: (res) => {
              const fs = wx.getFileSystemManager();
              const stats = fs.getFileInfoSync(res.tempFilePath);

              if (stats.size > maxSizeBytes && quality > 0.1) {
                quality -= 0.1;
                tryCompress();
              } else if (stats.size > maxSizeBytes) {
                drawWidth = Math.floor(drawWidth * 0.8);
                drawHeight = Math.floor(drawHeight * 0.8);
                quality = 0.5;
                tryCompress();
              } else {
                resolve(res.tempFilePath);
              }
            },
            fail: reject,
          });
        };

        tryCompress();
      },
      fail: reject,
    });
  });
}

module.exports = {
  compressImage: compressImage,
};