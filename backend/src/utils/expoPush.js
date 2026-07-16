/**
 * expoPush.js
 *
 * BACKWARD-COMPATIBILITY SHIM.
 * Re-exports everything from pushSender.js so existing imports
 * (debug scripts, tests) continue to work.
 *
 * New code should import from pushSender.js directly.
 */

const {
  buildMessage,
  sendSinglePush,
  sendBatchPush,
  removeInvalidToken,
  sendExpoPush,
} = require('./pushSender');

module.exports = {
  buildMessage,
  sendSinglePush,
  sendBatchPush,
  clearStaleToken: removeInvalidToken, // legacy name
  sendExpoPush,
};
