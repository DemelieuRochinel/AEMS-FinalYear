/**
 * FIX RELAY STATUS FOR EXISTING ROOMS
 * 
 * Run: node src/scripts/fixRelayStatus.js
 */

const db = require('../config/firebase');

async function fixRelayStatus() {
  console.log('🔧 Fixing relay status for all rooms...\n');

  try {
    // Get all businesses
    const rootSnapshot = await db.ref('/').once('value');
    const allBusinesses = [];

    if (rootSnapshot.exists()) {
      const rootData = rootSnapshot.val();
      const keys = Object.keys(rootData);

      // Find business keys (start with 'biz_' or 'business_')
      const potentialBusinessKeys = keys.filter(key => 
        key.startsWith('biz_') || 
        key.startsWith('business_') ||
        key === 'BUEA001'
      );

      for (const key of potentialBusinessKeys) {
        const roomsCheck = await db.ref(`${key}/rooms`).once('value');
        if (roomsCheck.exists()) {
          allBusinesses.push(key);
        }
      }
    }

    // Also check /rooms path
    const roomsSnapshot = await db.ref('rooms').once('value');
    if (roomsSnapshot.exists()) {
      roomsSnapshot.forEach((room) => {
        if (!allBusinesses.includes(room.key)) {
          allBusinesses.push(room.key);
        }
      });
    }

    if (allBusinesses.length === 0) {
      console.log('❌ No businesses with rooms found');
      return;
    }

    console.log(`📋 Found ${allBusinesses.length} businesses with rooms\n`);

    let totalUpdated = 0;

    for (const businessId of allBusinesses) {
      console.log(`📋 Processing business: ${businessId}`);

      // Check all possible room locations
      const locations = [
        `rooms/${businessId}`,
        `${businessId}/rooms`,
        businessId
      ];

      let roomsFound = false;

      for (const location of locations) {
        try {
          const snapshot = await db.ref(location).once('value');
          if (snapshot.exists()) {
            const data = snapshot.val();
            const roomKeys = Object.keys(data).filter(k => k.startsWith('room_'));

            if (roomKeys.length > 0) {
              roomsFound = true;
              console.log(`  ✅ Found ${roomKeys.length} rooms at /${location}`);

              for (const roomId of roomKeys) {
                const roomData = data[roomId];
                const occupied = roomData.occupied || false;
                const relayStatus = occupied ? 'ON' : 'OFF';

                // Only update if relay_status is missing or different
                if (roomData.relay_status !== relayStatus || !roomData.relay_status) {
                  await db.ref(`${location}/${roomId}`).update({
                    relay_status: relayStatus,
                    status: relayStatus,
                    updated_at: new Date().toISOString()
                  });
                  totalUpdated++;
                  console.log(`    ✅ Updated ${roomId} → ${relayStatus}`);
                } else {
                  console.log(`    ℹ️  ${roomId} already has correct status: ${relayStatus}`);
                }
              }
              break; // Found rooms, stop checking other locations
            }
          }
        } catch (err) {
          // Path doesn't exist, try next
        }
      }

      if (!roomsFound) {
        console.log(`  ℹ️  No rooms found for ${businessId}`);
      }
      console.log('');
    }

    console.log(`✅ Successfully updated ${totalUpdated} rooms with relay status!`);
    console.log('🔄 Refresh your dashboard to see the changes.');

  } catch (error) {
    console.error('❌ Error fixing relay status:', error.message);
  }
}

fixRelayStatus();