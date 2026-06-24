/**
 * FIX ROOM RELAY IDs
 * 
 * Run: node src/scripts/fixRoomRelayIds.js
 */

const db = require('../config/firebase');

async function fixRoomRelayIds() {
  console.log('🔧 Fixing room relay IDs...\n');

  try {
    // Find all businesses with rooms
    const businesses = ['biz_1782296529169']; // Add your business ID here
    
    // Or automatically find all businesses
    const rootSnapshot = await db.ref('/').once('value');
    const allBusinesses = [];

    if (rootSnapshot.exists()) {
      const rootData = rootSnapshot.val();
      const keys = Object.keys(rootData);
      
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

    console.log(`📋 Found ${allBusinesses.length} businesses\n`);

    let totalUpdated = 0;

    for (const businessId of allBusinesses) {
      console.log(`📋 Processing business: ${businessId}`);

      // Check different possible locations
      const locations = [`rooms/${businessId}`, `${businessId}/rooms`, businessId];
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
                const updates = {};

                // If relay_id is missing, set it based on room ID
                if (!roomData.relay_id) {
                  const match = roomId.match(/room_(\d+)/);
                  const relayId = match ? `relay_${match[1]}` : 'relay_1';
                  
                  updates.relay_id = relayId;
                  console.log(`    ✅ Updated ${roomId} → relay_id: ${relayId}`);
                  totalUpdated++;
                }

                // If device_id is missing, try to find one
                if (!roomData.device_id) {
                  try {
                    const devicesSnapshot = await db.ref('devices')
                      .orderByChild('business_id')
                      .equalTo(businessId)
                      .once('value');
                    
                    if (devicesSnapshot.exists()) {
                      let deviceId = null;
                      devicesSnapshot.forEach((device) => {
                        if (!deviceId) {
                          deviceId = device.key;
                        }
                      });
                      if (deviceId) {
                        updates.device_id = deviceId;
                        console.log(`    ✅ Updated ${roomId} → device_id: ${deviceId}`);
                      }
                    }
                  } catch (err) {
                    console.log(`    ⚠️  Could not find device for ${businessId}`);
                  }
                }

                // Apply updates if any
                if (Object.keys(updates).length > 0) {
                  await db.ref(`${location}/${roomId}`).update({
                    ...updates,
                    updated_at: new Date().toISOString()
                  });
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

    console.log(`✅ Successfully updated ${totalUpdated} rooms with relay_id!`);
    console.log('🔄 Try toggling rooms now!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixRoomRelayIds();