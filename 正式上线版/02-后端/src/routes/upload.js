/**
 * 亏了 · 正式上线版 · 文件上传接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   POST /api/upload/photo   上传打卡照片（multipart/form-data，字段名 file）
 *
 * 【限制】
 *   · 单张最大 5MB
 *   · 只接受 jpg / png / webp
 *   · 图片会重新压缩成 1200px 以内再存，省流量也省 COS 空间
 */
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { ok, BizError, ERR } = require('../utils');
const cos = require('../services/cos');
const logger = require('../logger');

const router = express.Router();

/* multer：接收 multipart 文件上传 */
const upload = multer({
  storage: multer.memoryStorage(),   // 存在内存里，不落磁盘
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const okTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (okTypes.indexOf(file.mimetype) >= 0) {
      cb(null, true);
    } else {
      cb(new BizError(ERR.PARAM, '只支持 jpg / png / webp 格式的图片'));
    }
  },
});

/**
 * POST /api/upload/photo
 */
router.post('/photo', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new BizError(ERR.PARAM, '没有收到文件');

    const ext = (req.file.originalname || 'x.jpg').split('.').pop();
    const r = await cos.uploadCheckinPhoto(req.file.buffer, ext);

    res.json(ok({ url: r.url, size: req.file.size }, '上传成功'));
  } catch (e) {
    if (e && e.code === 'LIMIT_FILE_SIZE') {
      logger.warn('上传图片超过大小限制');
      res.status(400).json({ code: ERR.PARAM, msg: '图片不能超过 5MB', data: null });
      return;
    }
    next(e);
  }
});

module.exports = router;
