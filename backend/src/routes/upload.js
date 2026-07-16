const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configure multer to store in memory (we'll upload to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, png, gif, webp) are allowed'));
    }
  },
});

// Ensure the storage bucket exists (run once)
let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = (buckets || []).some(b => b.name === 'chat-images');
    if (!exists) {
      await supabase.storage.createBucket('chat-images', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      });
    }
    bucketReady = true;
  } catch (err) {
    console.warn('Bucket check/create failed:', err.message);
    // Still mark ready so we don't retry every request
    bucketReady = true;
  }
}

// @route   POST /api/upload
// @desc    Upload an image and return its public URL
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    console.log('[Upload] Request received, file:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'NO FILE');
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    await ensureBucket();

    const ext = path.extname(req.file.originalname || '.jpg').toLowerCase() || '.jpg';
    const filename = `${req.user.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Storage upload error:', error);
      return res.status(500).json({ success: false, message: 'Failed to upload image' });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(data.path);

    res.json({ success: true, data: { url: urlData.publicUrl } });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

module.exports = router;
