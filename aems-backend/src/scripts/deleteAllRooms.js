/**
 * DELETE ALL ROOMS FROM FIREBASE
 * 
 * WARNING: This will permanently delete ALL room data!
 * 
 * Run: node src/scripts/deleteAllRooms.js
 */

const db = require('../config/firebase');

async function deleteAllRooms() {
  console.log('⚠️  WARNING: This will delete ALL room data from ALL businesses!\n');
  
  // Confirm before proceeding
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const confirm = await new Promise((resolve) => {
    rl.question('Type "DELETE ALL ROOMS" to confirm: ', (answer) => {
      resolve(answer === 'DELETE ALL ROOMS');
    });
  });

  if (!confirm) {
    console.log('❌ Operation cancelled.');
    rl.close();
    return;
  }

  console.log('\n🗑️  Deleting all rooms...\n');

  try {
    // ── METHOD 1: Check if businesses are at root level ──
    let businessesSnapshot = await db.ref('businesses').once('value');
    let businesses = [];

    if (businessesSnapshot.exists()) {
      businessesSnapshot.forEach((business) => {
        businesses.push(business.key);
      });
      console.log(`📋 Found ${businesses.length} businesses at /businesses`);
    } else {
      console.log('ℹ️  No businesses found at /businesses');
    }

    // ── METHOD 2: Check if businesses are at root level directly ──
    // Some businesses might be at root level (biz_xxx)
    if (businesses.length === 0) {
      console.log('🔍 Checking for businesses at root level...');
      const rootSnapshot = await db.ref('/').once('value');
      
      if (rootSnapshot.exists()) {
        const allKeys = Object.keys(rootSnapshot.val());
        // Look for keys that start with 'biz_' or 'business_'
        const businessKeys = allKeys.filter(key => 
          key.startsWith('biz_') || 
          key.startsWith('business_') ||
          key === 'BUEA001'
        );
        
        // Also check if these keys have rooms
        for (const key of businessKeys) {
          const roomsCheck = await db.ref(`${key}/rooms`).once('value');
          if (roomsCheck.exists()) {
            businesses.push(key);
            console.log(`  ✅ Found business with rooms: ${key}`);
          } else {
            // Check if the key itself contains room data
            const roomCheck = await db.ref(key).once('value');
            if (roomCheck.exists() && roomCheck.val().room_1) {
              businesses.push(key);
              console.log(`  ✅ Found business with rooms: ${key}`);
            }
          }
        }
      }
    }

    // ── METHOD 3: Check /rooms path directly ──
    if (businesses.length === 0) {
      console.log('🔍 Checking /rooms path directly...');
      const roomsSnapshot = await db.ref('rooms').once('value');
      
      if (roomsSnapshot.exists()) {
        roomsSnapshot.forEach((room) => {
          // Each key under /rooms is a business ID
          if (!businesses.includes(room.key)) {
            businesses.push(room.key);
            console.log(`  ✅ Found business in /rooms: ${room.key}`);
          }
        });
      }
    }

    if (businesses.length === 0) {
      console.log('❌ No businesses with rooms found in any location.');
      console.log('💡 Check your Firebase structure:');
      console.log('   - Are businesses stored at /businesses?');
      console.log('   - Are they at root level (biz_xxx)?');
      console.log('   - Are they at /rooms/biz_xxx?');
      rl.close();
      return;
    }

    console.log(`\n📋 Found ${businesses.length} businesses with rooms:\n`);
    businesses.forEach(b => console.log(`  - ${b}`));

    // Final confirmation
    const finalConfirm = await new Promise((resolve) => {
      rl.question(`\nDelete rooms from ${businesses.length} businesses? (y/N): `, (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });

    if (!finalConfirm) {
      console.log('❌ Operation cancelled.');
      rl.close();
      return;
    }

    let totalDeleted = 0;

    for (const businessId of businesses) {
      console.log(`\n📋 Processing: ${businessId}`);
      
      // Try different possible paths
      const possiblePaths = [
        `rooms/${businessId}`,
        `${businessId}/rooms`,
        businessId
      ];

      let found = false;
      
      for (const path of possiblePaths) {
        try {
          const snapshot = await db.ref(path).once('value');
          if (snapshot.exists()) {
            const roomData = snapshot.val();
            // Check if this actually contains rooms (has room_1, room_2, etc.)
            const roomKeys = Object.keys(roomData).filter(k => k.startsWith('room_'));
            
            if (roomKeys.length > 0) {
              console.log(`  ✅ Found ${roomKeys.length} rooms at /${path}`);
              await db.ref(path).remove();
              totalDeleted += roomKeys.length;
              found = true;
              break;
            }
          }
        } catch (err) {
          // Path doesn't exist, try next
        }
      }

      if (!found) {
        console.log(`  ℹ️  No rooms found for ${businessId}`);
      }
    }

    console.log(`\n✅ Successfully deleted ${totalDeleted} rooms!`);
    console.log('🔄 Run your ESP32 simulator to create fresh rooms with proper names.');

  } catch (error) {
    console.error('❌ Error deleting rooms:', error.message);
  }

  rl.close();
}

// Run the script
deleteAllRooms();