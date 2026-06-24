const db = require('../config/firebase');

async function initializeFirebase() {
  console.log('🚀 Initializing Firebase Database Structure...\n');

  try {
    // Create placeholder for device_setup
    await db.ref('device_setup/_metadata').set({
      created_at: new Date().toISOString(),
      description: 'Device setup codes for ESP32 provisioning'
    });
    console.log('✅ device_setup collection initialized');

    console.log('\n✅ Firebase initialization complete!');
    console.log('\n📁 New collection added:');
    console.log('   device_setup/');
    console.log('   └── {deviceId}/');
    console.log('       ├── code: "123456"');
    console.log('       ├── device_id: "dev_xxx"');
    console.log('       ├── business_id: "biz_xxx"');
    console.log('       ├── created_at: timestamp');
    console.log('       ├── expires_at: timestamp');
    console.log('       ├── used: false');
    console.log('       ├── used_at: null');
    console.log('       └── claimed_by_mac: null');

  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  initializeFirebase();
}

module.exports = initializeFirebase;