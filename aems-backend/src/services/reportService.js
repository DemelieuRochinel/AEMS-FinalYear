const db = require('../config/firebase');
const { getReadingsByDate, calculateCostFcfa } = require('./readingsService');

const reportsRef = (businessId) => db.ref(`monthly_reports/${businessId}`);

//  GENERATE — Build complete monthly report
const generateMonthlyReport = async (businessId, year, month) => {
  try {
    const monthKey  = `${year}_${String(month).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month, 0).getDate();

    let totalKwh     = 0;
    let peakDayKwh   = 0;
    let peakDay      = '';
    let voltageReadings = [];
    const dailyBreakdown = {};

    // Loop through every day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const readings = await getReadingsByDate(businessId, year, month, day);

      if (readings.length === 0) continue;

      const dayMaxKwh = Math.max(...readings.map(r => r.main.energy_kwh || 0));
      const dayVoltages = readings
        .map(r => r.main.voltage)
        .filter(v => v > 0);

      voltageReadings = voltageReadings.concat(dayVoltages);

      const formattedDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

      dailyBreakdown[formattedDate] = {
        kwh:       dayMaxKwh,
        cost_fcfa: calculateCostFcfa(dayMaxKwh),
        readings_count: readings.length,
      };

      totalKwh += dayMaxKwh;

      if (dayMaxKwh > peakDayKwh) {
        peakDayKwh = dayMaxKwh;
        peakDay    = formattedDate;
      }
    }

    const avgVoltage = voltageReadings.length > 0
      ? Math.round((voltageReadings.reduce((a, b) => a + b, 0) / voltageReadings.length) * 10) / 10
      : 0;

    const totalCostFcfa = calculateCostFcfa(totalKwh);

    // Get previous month for comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevKey   = `${prevYear}_${String(prevMonth).padStart(2, '0')}`;

    const prevSnap  = await reportsRef(businessId).child(prevKey).once('value');
    const prevData  = prevSnap.exists() ? prevSnap.val() : null;

    const savingsKwh   = prevData ? Math.max(0, prevData.total_kwh   - totalKwh)       : 0;
    const savingsFcfa  = prevData ? Math.max(0, prevData.total_cost_fcfa - totalCostFcfa) : 0;
    const savingsPct   = prevData && prevData.total_kwh > 0
      ? Math.round((savingsKwh / prevData.total_kwh) * 100)
      : 0;

    const report = {
      period:            `${year}-${String(month).padStart(2, '0')}`,
      generated_at:      new Date().toISOString(),
      business_id:       businessId,
      total_kwh:         Math.round(totalKwh * 100) / 100,
      total_cost_fcfa:   totalCostFcfa,
      previous_kwh:      prevData?.total_kwh      || null,
      previous_cost_fcfa:prevData?.total_cost_fcfa || null,
      savings_kwh:       Math.round(savingsKwh * 100) / 100,
      savings_fcfa:      savingsFcfa,
      savings_percent:   savingsPct,
      avg_voltage:       avgVoltage,
      peak_day:          peakDay,
      peak_day_kwh:      Math.round(peakDayKwh * 100) / 100,
      daily_breakdown:   dailyBreakdown,
    };

    // Save to Firebase
    await reportsRef(businessId).child(monthKey).set(report);

    return { success: true, reportKey: monthKey, data: report };

  } catch (error) {
    console.error('generateMonthlyReport error:', error.message);
    throw new Error(`Failed to generate report: ${error.message}`);
  }
};

//  READ — Get a specific monthly report
const getMonthlyReport = async (businessId, year, month) => {
  try {
    const monthKey = `${year}_${String(month).padStart(2, '0')}`;
    const snapshot = await reportsRef(businessId).child(monthKey).once('value');

    if (!snapshot.exists()) return null;

    return { key: monthKey, ...snapshot.val() };

  } catch (error) {
    console.error('getMonthlyReport error:', error.message);
    throw new Error(`Failed to get report: ${error.message}`);
  }
};

//  READ — Get all reports for a business (report history)
const getAllReports = async (businessId) => {
  try {
    const snapshot = await reportsRef(businessId).once('value');
    if (!snapshot.exists()) return [];

    const reports = [];
    snapshot.forEach((child) => {
      reports.push({ key: child.key, ...child.val() });
    });

    return reports.sort((a, b) => b.period.localeCompare(a.period));

  } catch (error) {
    console.error('getAllReports error:', error.message);
    throw new Error(`Failed to get all reports: ${error.message}`);
  }
};

module.exports = {
  generateMonthlyReport,
  getMonthlyReport,
  getAllReports,
};