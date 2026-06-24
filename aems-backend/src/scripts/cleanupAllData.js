/**
 * COMPLETE CLEANUP SCRIPT - Fixed for Root Level Businesses
 * 
 * Deletes ALL test data from Firebase:
 * - All rooms (for all businesses)
 * - All readings (for all businesses)
 * - All devices (for all businesses)
 * 
 * Keeps: Businesses and Users (so you don't need to re-register)
 * 
 * Run: node src/scripts/cleanupAllData.js
 */

const db = require('../config/firebase');

async function cleanupAllData() {
  console.log('🧹 AEMS DATA CLEANUP\n');
  console.log('This will delete:');
  console.log('  ❌ ALL rooms (across ALL businesses)');
  console.log('  ❌ ALL readings (across ALL businesses)');
  console.log('  ❌ ALL devices (across ALL businesses)');
  console.log('');
  console.log('  ✅ Businesses will be KEPT');
  console.log('  ✅ Users will be KEPT');
  console.log('  ✅ Device setup codes will be KEPT');
  console.log('');

  // Confirm before proceeding
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const confirm = await new Promise((resolve) => {
    rl.question('Type "CLEAN ALL" to confirm deletion: ', (answer) => {
      resolve(answer === 'CLEAN ALL');
    });
  });

  if (!confirm) {
    console.log('❌ Operation cancelled.');
    rl.close();
    return;
  }

  console.log('\n🗑️  Scanning Firebase for businesses...\n');

  try {
    // ── STEP 1: Find ALL businesses ──
    const rootSnapshot = await db.ref('/').once('value');
    const allBusinesses = [];

    if (rootSnapshot.exists()) {
      const rootData = rootSnapshot.val();
      const keys = Object.keys(rootData);

      // Look for business IDs (start with 'biz_' or 'business_')
      const potentialBusinessKeys = keys.filter(key => 
        key.startsWith('biz_') || 
        key.startsWith('business_') ||
        key === 'BUEA001'
      );

      console.log(`🔍 Found ${potentialBusinessKeys.length} potential business keys at root level`);

      // Check each one to see if it has data
      for (const key of potentialBusinessKeys) {
        const snapshot = await db.ref(key).once('value');
        if (snapshot.exists()) {
          allBusinesses.push(key);
          console.log(`  ✅ Found business: ${key}`);
        }
      }
    }

    // ── STEP 2: Also check /businesses path ──
    const businessesSnapshot = await db.ref('businesses').once('value');
    if (businessesSnapshot.exists()) {
      businessesSnapshot.forEach((business) => {
        if (!allBusinesses.includes(business.key)) {
          allBusinesses.push(business.key);
          console.log(`  ✅ Found business in /businesses: ${business.key}`);
        }
      });
    }

    // ── STEP 3: Also check /rooms path ──
    const roomsSnapshot = await db.ref('rooms').once('value');
    if (roomsSnapshot.exists()) {
      roomsSnapshot.forEach((room) => {
        if (!allBusinesses.includes(room.key)) {
          allBusinesses.push(room.key);
          console.log(`  ✅ Found business in /rooms: ${room.key}`);
        }
      });
    }

    if (allBusinesses.length === 0) {
      console.log('❌ No businesses found in any location.');
      console.log('💡 Your Firebase structure might be different.');
      console.log('   Please run: node src/scripts/checkFirebaseStructure.js');
      rl.close();
      return;
    }

    console.log(`\n📋 Found ${allBusinesses.length} businesses total:`);
    allBusinesses.forEach(b => console.log(`  - ${b}`));

    // ── STEP 4: Final confirmation ──
    const finalConfirm = await new Promise((resolve) => {
      rl.question(`\nDelete ALL rooms, readings, and devices from ${allBusinesses.length} businesses? (y/N): `, (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });

    if (!finalConfirm) {
      console.log('❌ Operation cancelled.');
      rl.close();
      return;
    }

    console.log('\n🗑️  Deleting data...\n');

    let totalRooms = 0;
    let totalReadings = 0;
    let totalDevices = 0;

    for (const businessId of allBusinesses) {
      console.log(`📋 Processing business: ${businessId}`);

      // ── 1. Delete rooms ──
      // Check multiple possible locations for rooms
      const roomLocations = [
        `rooms/${businessId}`,
        `${businessId}/rooms`,
        businessId  // Direct rooms at root level
      ];

      let roomsFound = false;
      for (const location of roomLocations) {
        try {
          const snapshot = await db.ref(location).once('value');
          if (snapshot.exists()) {
            const data = snapshot.val();
            // Check if this is actually room data (has room_1, room_2, etc.)
            const roomKeys = Object.keys(data).filter(k => k.startsWith('room_'));
            if (roomKeys.length > 0) {
              await db.ref(location).remove();
              totalRooms += roomKeys.length;
              console.log(`  ✅ Deleted ${roomKeys.length} rooms from /${location}`);
              roomsFound = true;
              break;
            }
          }
        } catch (err) {
          // Path doesn't exist, try next
        }
      }
      if (!roomsFound) {
        console.log(`  ℹ️  No rooms found`);
      }

      // ── 2. Delete readings ──
      const readingLocations = [
        `readings/${businessId}`,
        `${businessId}/readings`
      ];

      let readingsFound = false;
      for (const location of readingLocations) {
        try {
          const snapshot = await db.ref(location).once('value');
          if (snapshot.exists()) {
            const readingCount = snapshot.numChildren();
            await db.ref(location).remove();
            totalReadings += readingCount;
            console.log(`  ✅ Deleted ${readingCount} readings from /${location}`);
            readingsFound = true;
            break;
          }
        } catch (err) {
          // Path doesn't exist, try next
        }
      }
      if (!readingsFound) {
        console.log(`  ℹ️  No readings found`);
      }

      // ── 3. Delete devices ──
      try {
        const devicesSnapshot = await db.ref('devices').orderByChild('business_id').equalTo(businessId).once('value');
        if (devicesSnapshot.exists()) {
          let deviceCount = 0;
          const updates = {};
          devicesSnapshot.forEach((device) => {
            updates[device.key] = null;
            deviceCount++;
          });
          await db.ref('devices').update(updates);
          totalDevices += deviceCount;
          console.log(`  ✅ Deleted ${deviceCount} devices`);
        } else {
          console.log(`  ℹ️  No devices found`);
        }
      } catch (err) {
        console.log(`  ℹ️  No devices found`);
      }

      console.log('');
    }

    console.log('📊 CLEANUP SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  🗑️  Total rooms deleted:    ${totalRooms}`);
    console.log(`  🗑️  Total readings deleted:  ${totalReadings}`);
    console.log(`  🗑️  Total devices deleted:   ${totalDevices}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ Cleanup complete!');
    console.log('');
    console.log('📌 What was kept:');
    console.log('  ✅ Businesses (biz_xxx)');
    console.log('  ✅ Users');
    console.log('  ✅ Device setup codes');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('  1. Run your ESP32 simulator to create fresh data:');
    console.log('     node src/test/simulateESP32.js');
    console.log('  2. Check the dashboard for clean data');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error('Full error:', error);
  }

  rl.close();
}

// Run the script
cleanupAllData();