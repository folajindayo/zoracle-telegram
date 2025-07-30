/**
 * Lock Manager for Zoracle Telegram Bot
 * 
 * Prevents multiple instances of the bot from running simultaneously
 * by using a file-based lock mechanism.
 */

const fs = require('fs');
const path = require('path');

// Lock file path
const LOCK_FILE = path.join(__dirname, '../.bot.lock');

/**
 * Attempts to acquire a lock for the bot
 * @returns {boolean} True if lock was acquired, false otherwise
 */
function acquireLock() {
  try {
    // Check if lock file exists
    if (fs.existsSync(LOCK_FILE)) {
      // Check if the process in the lock file is still running
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      
      try {
        // Check if process is still running
        process.kill(parseInt(pid, 10), 0);
        
        // Process is still running, can't acquire lock
        return false;
      } catch (e) {
        // Process is not running, remove stale lock
        fs.unlinkSync(LOCK_FILE);
      }
    }
    
    // Create lock file with current process ID
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    return true;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
}

/**
 * Releases the lock
 * @returns {boolean} True if lock was released, false otherwise
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      
      // Only remove lock if it belongs to this process
      if (parseInt(pid, 10) === process.pid) {
        fs.unlinkSync(LOCK_FILE);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error releasing lock:', error);
    return false;
  }
}

module.exports = {
  acquireLock,
  releaseLock
}; 