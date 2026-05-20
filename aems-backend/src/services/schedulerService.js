//  SCHEDULER SERVICE
//  Runs timed tasks automatically
//
//  Schedule:
//  Every day at 20:00   → Send daily energy summary
//  Every 1st at 07:00   → Send monthly report
//  Every day at 00:00   → Reset daily kWh counter
//
//  University of Buea — LEKEUGO DEMELIEU ROCHINEL FE22A247

const cron                = require('node-cron');
const notificationService = require('./notificationService');
const reportService       = require('./reportService');
const businessService     = require('./businessService');

let schedulerRunning = false;

//  INITIALIZE — Register all scheduled tasks
const initialize = () => {
  if (schedulerRunning) {
    console.log('Scheduler already running');
    return;
  }

  console.log('Scheduler starting...');

  //Task 1: Daily summary every day at 8PM
  cron.schedule('0 20 * * *', async () => {
    console.log('Scheduler: running daily summary task');
    await notificationService.sendDailySummaryToAll();
  }, {
    timezone: 'Africa/Douala',
  });
  console.log('  → Daily summary: every day at 20:00 (Douala time)');

  //Task 2: Monthly report on 1st of every month at 7Am
  cron.schedule('0 7 1 * *', async () => {
    console.log('Scheduler: running monthly report task');
    await _generateAndSendMonthlyReports();
  }, {
    timezone: 'Africa/Douala',
  });
  console.log('  → Monthly reports: every 1st at 07:00 (Douala time)');

  // Task 3: Health check every hour
  cron.schedule('0 * * * *', () => {
    console.log(`Scheduler heartbeat: ${new Date().toISOString()}`);
  });

  schedulerRunning = true;
  console.log('Scheduler running — all tasks registered');
};

// Generate and send monthly reports for all businesses 
const _generateAndSendMonthlyReports = async () => {
  try {
    const businesses = await businessService.getAllBusinesses();
    const now        = new Date();

    // Report is for the PREVIOUS month
    const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const reportYear  = now.getMonth() === 0
      ? now.getFullYear() - 1
      : now.getFullYear();

    for (const business of businesses) {
      try {
        await reportService.generateMonthlyReport(
          business.id, reportYear, reportMonth
        );
        console.log(`Monthly report generated: ${business.name}`);
      } catch (err) {
        console.error(`Report failed for ${business.id}:`, err.message);
      }
    }

    await notificationService.sendMonthlyReportToAll();

  } catch (err) {
    console.error('Monthly report task error:', err.message);
  }
};

const getStatus = () => ({ schedulerRunning });

module.exports = { initialize, getStatus };