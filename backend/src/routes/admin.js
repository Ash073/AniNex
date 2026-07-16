const express = require('express');
const { protect } = require('../middleware/auth');
const { sendDailyFacts } = require('../../scripts/sendDailyFact');

const router = express.Router();

// @route   POST /api/admin/trigger-daily-fact
// @desc    Trigger the daily anime fact notification campaign
router.post('/trigger-daily-fact', protect, async (req, res) => {
    try {
        // Only allow admins (or specific user ID for testing)
        // For now, let's allow it for testing purposes
        // if (req.user.role !== 'admin') {
        //   return res.status(403).json({ success: false, message: 'Admin access only' });
        // }

        // Run the campaign in the background
        sendDailyFacts();

        res.json({ success: true, message: 'Daily anime fact campaign triggered successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
