const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Recording = require('./models/Recording');
const MeetingSession = require('./models/MeetingSession');

const uploadsDir = path.join(__dirname, '../uploads');
const DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes recordings and hosted-meeting history older than each user's chosen retention period.
 * Users who keep the default (no period) are never touched.
 */
async function sweepRetention({ now = () => new Date(), removeFile = name => fs.promises.rm(path.join(uploadsDir, path.basename(name)), { force: true }) } = {}) {
  const users = await User.find({ 'preferences.privacy.retentionDays': { $in: [30, 90, 365] } }).select('preferences.privacy.retentionDays').lean();
  let recordings = 0, sessions = 0;
  for (const user of users) {
    const cutoff = new Date(now().getTime() - user.preferences.privacy.retentionDays * DAY);
    for (const recording of await Recording.find({ uploadedBy: user._id, createdAt: { $lt: cutoff } })) {
      await removeFile(recording.filename);
      await recording.deleteOne();
      recordings += 1;
    }
    sessions += (await MeetingSession.deleteMany({ host: user._id, endedAt: { $lt: cutoff } })).deletedCount || 0;
  }
  return { recordings, sessions };
}

/** Runs the sweep now and every 6 hours. */
function scheduleRetention(log = console.log) {
  const run = () => sweepRetention()
    .then(r => { if (r.recordings || r.sessions) log(`Retention: removed ${r.recordings} recording(s), ${r.sessions} meeting record(s).`); })
    .catch(error => console.error('Retention sweep failed:', error.message));
  run();
  const timer = setInterval(run, 6 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = { sweepRetention, scheduleRetention };
