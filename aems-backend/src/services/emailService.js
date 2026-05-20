//  EMAIL NOTIFICATION SERVICE
//  Sends formatted HTML emails to business owners
//  Uses Nodemailer with Gmail SMTP
//
//  Setup required in .env:
//  EMAIL_USER=your-gmail@gmail.com
//  EMAIL_PASS=your-app-password (NOT your real password)
//
//  To get Gmail App Password:
//  Google Account → Security → 2-Step Verification → App Passwords
//  Select: Mail → Other → name it "AEMS" → copy the 16-char password
//


const nodemailer = require('nodemailer');
require('dotenv').config();

//Email transporter
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

// Color constants for HTML emails
const COLORS = {
  primary:  '#1A3A5C',
  teal:     '#1D9E75',
  coral:    '#D85A30',
  amber:    '#BA7517',
  purple:   '#534AB7',
  gray:     '#888780',
  lightBg:  '#F1EFE8',
};

// Base HTML email template
const baseTemplate = (title, content, color = COLORS.primary) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:${color};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">
                AEMS — Automated Energy Management
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
                ${title}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${COLORS.lightBg};padding:16px 32px;
                       border-top:1px solid #e0e0e0;">
              <p style="margin:0;color:${COLORS.gray};font-size:12px;text-align:center;">
                AEMS — University of Buea, Cameroon |
                LEKEUGO DEMELIEU ROCHINEL <br>
                This is an automated message from your energy management system.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

//  SEND — Urgent alert email
const sendUrgentAlert = async (toEmail, businessName, alert) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('ℹEmail not configured — skipping urgent alert email');
    return { success: false, reason: 'not_configured' };
  }

  const isVoltage = alert.type.includes('voltage');
  const color     = isVoltage ? COLORS.coral : COLORS.amber;

  const icon = alert.type === 'low_voltage'  ? 'LOW VOLTAGE'  :
               alert.type === 'high_voltage' ? 'HIGH VOLTAGE' :
               alert.type === 'device_offline' ? 'DEVICE OFFLINE' : 'ALERT';

  const content = `
    <div style="background:#FFF3F0;border-left:4px solid ${COLORS.coral};
                padding:16px;border-radius:4px;margin-bottom:24px;">
      <h2 style="margin:0 0 8px;color:${COLORS.coral};font-size:18px;">
        ${icon}
      </h2>
      <p style="margin:0;color:#333;font-size:15px;font-weight:bold;">
        ${alert.message}
      </p>
    </div>

    <table width="100%" cellpadding="8" cellspacing="0"
           style="border-collapse:collapse;">
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};width:40%;">Business</td>
        <td style="font-size:14px;color:#333;font-weight:bold;">${businessName}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${COLORS.gray};">Alert type</td>
        <td style="font-size:14px;color:#333;">${alert.type}</td>
      </tr>
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};">Severity</td>
        <td style="font-size:14px;color:${COLORS.coral};font-weight:bold;">
          ${alert.severity.toUpperCase()}
        </td>
      </tr>
      ${alert.value ? `
      <tr>
        <td style="font-size:13px;color:${COLORS.gray};">Value detected</td>
        <td style="font-size:14px;color:#333;">${alert.value}${isVoltage ? 'V' : ''}</td>
      </tr>` : ''}
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};">Time</td>
        <td style="font-size:14px;color:#333;">
          ${new Date(alert.timestamp).toLocaleString('fr-CM')}
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;color:${COLORS.gray};font-size:13px;">
      Please check your AEMS dashboard for more details and to resolve this alert.
    </p>`;

  try {
    await getTransporter().sendMail({
      from:    `"AEMS Alert System" <${process.env.EMAIL_USER}>`,
      to:      toEmail,
      subject: `URGENT: ${alert.message.substring(0, 60)} — ${businessName}`,
      html:    baseTemplate(`Urgent Alert — ${businessName}`, content, COLORS.coral),
    });

    console.log(`Urgent alert email sent to ${toEmail}`);
    return { success: true, to: toEmail };

  } catch (err) {
    console.error('Email send failed:', err.message);
    return { success: false, error: err.message };
  }
};

//  SEND — Daily energy summary email
const sendDailySummary = async (toEmail, businessName, summaryData) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('ℹEmail not configured — skipping daily summary email');
    return { success: false, reason: 'not_configured' };
  }

  const {
    date, kwh, costFcfa, autoShutdowns,
    savedFcfa, activeAlerts, avgVoltage,
  } = summaryData;

  const content = `
    <h2 style="margin:0 0 24px;color:${COLORS.primary};font-size:20px;">
      Daily Energy Report — ${date}
    </h2>

    <!-- Key metrics -->
    <table width="100%" cellpadding="0" cellspacing="8">
      <tr>
        <td width="48%" style="background:${COLORS.lightBg};padding:16px;
                               border-radius:8px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${COLORS.gray};">
            ENERGY CONSUMED
          </p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:bold;
                    color:${COLORS.primary};">
            ${kwh.toFixed(2)} kWh
          </p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#E8F5E9;padding:16px;
                               border-radius:8px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${COLORS.gray};">
            TOTAL COST
          </p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:bold;
                    color:${COLORS.teal};">
            ${costFcfa.toLocaleString()} FCFA
          </p>
        </td>
      </tr>
    </table>

    <br>

    <!-- Details table -->
    <table width="100%" cellpadding="10" cellspacing="0"
           style="border-collapse:collapse;border:1px solid #e0e0e0;
                  border-radius:8px;overflow:hidden;">
      <tr style="background:${COLORS.primary};">
        <td style="color:white;font-size:13px;font-weight:bold;">Metric</td>
        <td style="color:white;font-size:13px;font-weight:bold;">Value</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${COLORS.gray};
                   border-bottom:1px solid #f0f0f0;">Auto-shutdowns executed</td>
        <td style="font-size:14px;color:#333;font-weight:bold;
                   border-bottom:1px solid #f0f0f0;">${autoShutdowns}</td>
      </tr>
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};
                   border-bottom:1px solid #f0f0f0;">Energy savings from automation</td>
        <td style="font-size:14px;color:${COLORS.teal};font-weight:bold;
                   border-bottom:1px solid #f0f0f0;">${savedFcfa.toLocaleString()} FCFA</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${COLORS.gray};
                   border-bottom:1px solid #f0f0f0;">Average voltage</td>
        <td style="font-size:14px;color:#333;
                   border-bottom:1px solid #f0f0f0;">${avgVoltage}V</td>
      </tr>
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};">Active alerts</td>
        <td style="font-size:14px;color:${activeAlerts > 0 ? COLORS.coral : COLORS.teal};
                   font-weight:bold;">${activeAlerts}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;color:${COLORS.gray};font-size:13px;">
      Log into your AEMS dashboard to view detailed analytics and reports.
    </p>`;

  try {
    await getTransporter().sendMail({
      from:    `"AEMS Daily Report" <${process.env.EMAIL_USER}>`,
      to:      toEmail,
      subject: `AEMS Daily Report — ${date} — ${businessName}`,
      html:    baseTemplate(`Daily Energy Report — ${businessName}`, content),
    });

    console.log(`Daily summary email sent to ${toEmail}`);
    return { success: true, to: toEmail };

  } catch (err) {
    console.error('Daily summary email failed:', err.message);
    return { success: false, error: err.message };
  }
};

//  SEND — Monthly report email
const sendMonthlyReport = async (toEmail, businessName, reportData) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('ℹEmail not configured — skipping monthly report email');
    return { success: false, reason: 'not_configured' };
  }

  const {
    period, totalKwh, totalCostFcfa,
    savingsKwh, savingsFcfa, savingsPct,
    peakDay,
  } = reportData;

  const hasSavings = savingsFcfa > 0;

  const content = `
    <h2 style="margin:0 0 8px;color:${COLORS.primary};font-size:20px;">
      Monthly Energy Report
    </h2>
    <p style="margin:0 0 24px;color:${COLORS.gray};font-size:14px;">${period}</p>

    <!-- Savings banner -->
    ${hasSavings ? `
    <div style="background:#E8F5E9;border-left:4px solid ${COLORS.teal};
                padding:16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:${COLORS.teal};font-size:16px;font-weight:bold;">
        Your AEMS saved you ${savingsFcfa.toLocaleString()} FCFA this month
        (${savingsPct}% reduction)
      </p>
    </div>` : ''}

    <table width="100%" cellpadding="12" cellspacing="0"
           style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;">
      <tr style="background:${COLORS.primary};">
        <td style="color:white;font-size:13px;font-weight:bold;">Metric</td>
        <td style="color:white;font-size:13px;font-weight:bold;text-align:right;">
          Value
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${COLORS.gray};border-bottom:1px solid #f0f0f0;">
          Total consumption
        </td>
        <td style="font-size:14px;color:#333;font-weight:bold;text-align:right;
                   border-bottom:1px solid #f0f0f0;">
          ${totalKwh.toFixed(2)} kWh
        </td>
      </tr>
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};border-bottom:1px solid #f0f0f0;">
          Total ENEO bill
        </td>
        <td style="font-size:16px;color:${COLORS.primary};font-weight:bold;
                   text-align:right;border-bottom:1px solid #f0f0f0;">
          ${totalCostFcfa.toLocaleString()} FCFA
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:${COLORS.gray};border-bottom:1px solid #f0f0f0;">
          Energy saved by AEMS
        </td>
        <td style="font-size:14px;color:${COLORS.teal};font-weight:bold;
                   text-align:right;border-bottom:1px solid #f0f0f0;">
          ${savingsKwh.toFixed(2)} kWh = ${savingsFcfa.toLocaleString()} FCFA
        </td>
      </tr>
      <tr style="background:${COLORS.lightBg};">
        <td style="font-size:13px;color:${COLORS.gray};">Peak consumption day</td>
        <td style="font-size:14px;color:#333;text-align:right;">${peakDay || 'N/A'}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;color:${COLORS.gray};font-size:13px;">
      Log into your AEMS dashboard to view the full monthly breakdown by room.
    </p>`;

  try {
    await getTransporter().sendMail({
      from:    `"AEMS Monthly Report" <${process.env.EMAIL_USER}>`,
      to:      toEmail,
      subject: ` AEMS Monthly Report — ${period} — ${businessName}`,
      html:    baseTemplate(`Monthly Report — ${businessName}`, content),
    });

    console.log(`Monthly report email sent to ${toEmail}`);
    return { success: true, to: toEmail };

  } catch (err) {
    console.error('Monthly report email failed:', err.message);
    return { success: false, error: err.message };
  }
};

//Verify email configuration
const verifyConfiguration = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email service: not configured (EMAIL_USER/EMAIL_PASS missing)');
    return false;
  }

  try {
    await getTransporter().verify();
    console.log('Email service: connected and ready');
    return true;
  } catch (err) {
    console.error('Email service: configuration error —', err.message);
    return false;
  }
};

module.exports = {
  sendUrgentAlert,
  sendDailySummary,
  sendMonthlyReport,
  verifyConfiguration,
};