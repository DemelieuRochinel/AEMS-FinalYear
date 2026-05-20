//  NOTIFICATION SERVICE
//  Orchestrates all alert notifications
//  Decides: email only? WhatsApp only? Both?
//
//  Priority:
//  URGENT  → WhatsApp + Email immediately
//  WARNING → Email immediately
//  INFO    → Collected for daily summary only
//

const emailService  = require('./emailService');
const alertsService = require('./alertsService');
const businessService = require('./businessService');
const userService   = require('./userService');

// ── Notification cooldown — prevent same notification twice ──
const notifiedAlerts = new Set();

//  MAIN — Send notification for a new alert
//  Called by automationEngine when a rule fires
const notifyAlert = async (businessId, alertId, alertData) => {
  try {
    // Prevent duplicate notifications for same alert
    if (notifiedAlerts.has(alertId)) return;
    notifiedAlerts.add(alertId);

    // Get business details for email content
    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      console.error(`notifyAlert: business ${businessId} not found`);
      return;
    }

    // Get business owner to find email
    const ownerEmail = business.owner_email;
    const businessName = business.name;

    if (!ownerEmail) {
      console.log(`No owner email for ${businessName} — skipping notification`);
      return;
    }

    const channels = [];

    // Route by severity
    if (alertData.severity === 'urgent') {
      // Urgent: send email immediately
      const emailResult = await emailService.sendUrgentAlert(
        ownerEmail, businessName, alertData
      );
      if (emailResult.success) channels.push('email');

      // Log WhatsApp attempt (Twilio configured in future)
      console.log(`WhatsApp notification → ${business.owner_phone || 'no phone set'}`);
      // channels.push('whatsapp'); // uncomment when Twilio is configured

    } else if (alertData.severity === 'warning') {
      // Warning: email only
      const emailResult = await emailService.sendUrgentAlert(
        ownerEmail, businessName, alertData
      );
      if (emailResult.success) channels.push('email');

    } else {
      // Info: just log — collected in daily summary
      console.log(`Info alert logged — will appear in daily summary`);
    }

    // Mark alert as notified in Firebase
    if (channels.length > 0) {
      await alertsService.markAlertNotified(businessId, alertId, channels);
    }

    return { success: true, channels };

  } catch (err) {
    console.error('notifyAlert error:', err.message);
    return { success: false, error: err.message };
  }
};

//  DAILY SUMMARY — Collect and send end-of-day report
//  Called by scheduler at 8PM every day
const sendDailySummaryToAll = async () => {
  console.log('Generating daily summaries...');

  try {
    const businesses = await businessService.getAllBusinesses();

    for (const business of businesses) {
      try {
        await sendDailySummaryForBusiness(business);
      } catch (err) {
        console.error(`Daily summary failed for ${business.id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('sendDailySummaryToAll error:', err.message);
  }
};

const sendDailySummaryForBusiness = async (business) => {
  const businessId = business.id;

  if (!business.owner_email) return;

  // Get today's alerts
  const alerts    = await alertsService.getAlertHistory(businessId, 100);
  const today     = new Date().toDateString();
  const todayAlerts = alerts.filter(a =>
    new Date(a.timestamp).toDateString() === today
  );

  const autoShutdowns = todayAlerts.filter(
    a => a.type === 'empty_room_shutdown'
  ).length;

  const savedFcfa = todayAlerts
    .filter(a => a.type === 'empty_room_shutdown')
    .reduce((sum, a) => sum + (a.cost_saved_fcfa || 0), 0);

  const activeAlerts = todayAlerts.filter(a => !a.resolved).length;

  const summaryData = {
    date:          new Date().toLocaleDateString('fr-CM'),
    kwh:           0,      // populated from readings in production
    costFcfa:      0,      // populated from readings in production
    autoShutdowns,
    savedFcfa,
    activeAlerts,
    avgVoltage:    220,    // populated from readings in production
  };

  await emailService.sendDailySummary(
    business.owner_email,
    business.name,
    summaryData
  );
};

//  MONTHLY REPORT — Send on 1st of each month
//  Called by scheduler on 1st day of month
const sendMonthlyReportToAll = async () => {
  console.log('📈 Generating monthly reports...');

  try {
    const businesses = await businessService.getAllBusinesses();
    const now        = new Date();
    const lastMonth  = now.getMonth() === 0 ? 12 : now.getMonth();
    const year       = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    for (const business of businesses) {
      if (!business.owner_email) continue;

      try {
        const reportData = {
          period:       `${getMonthName(lastMonth)} ${year}`,
          totalKwh:     0,
          totalCostFcfa:0,
          savingsKwh:   0,
          savingsFcfa:  0,
          savingsPct:   0,
          peakDay:      'N/A',
        };

        await emailService.sendMonthlyReport(
          business.owner_email,
          business.name,
          reportData
        );

      } catch (err) {
        console.error(`Monthly report failed for ${business.id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('sendMonthlyReportToAll error:', err.message);
  }
};

const getMonthName = (month) => {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  return months[month - 1] || 'Unknown';
};

module.exports = {
  notifyAlert,
  sendDailySummaryToAll,
  sendMonthlyReportToAll,
};