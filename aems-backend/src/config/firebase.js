const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {

  // ── Support BOTH .env credentials AND serviceAccountKey.json
  let credential;

  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    // ── Method 1: Read from .env variables (your current setup) ─
    credential = admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace escaped newlines — required when reading from .env
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

  } else {
    // ── Method 2: Read from serviceAccountKey.json file 
    const path = require('path');
    const serviceAccount = require(
      path.join(__dirname, 'serviceAccountKey.json')
    );
    credential = admin.credential.cert(serviceAccount);
    console.log('Firebase: using serviceAccountKey.json');
  }

  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  console.log('Firebase Admin SDK initialized successfully!');
}

// ── Get the database instance ──
const db = admin.database();

// ── Create named references ──
const deviceSetup = db.ref('device_setup');

// ── EXPORT: Maintain backward compatibility ──
// This makes both patterns work:
// 1. const db = require('./firebase') - gets the db object directly
// 2. const { db, deviceSetup } = require('./firebase') - gets named exports
module.exports = db;

// Also attach the named references to the exported function
// This allows destructuring imports
module.exports.db = db;
module.exports.deviceSetup = deviceSetup;
module.exports.businesses = db.ref('businesses');
module.exports.devices = db.ref('devices');
module.exports.users = db.ref('users');
module.exports.readings = db.ref('readings');
module.exports.rooms = db.ref('rooms');
module.exports.alerts = db.ref('alerts');
module.exports.bills = db.ref('bills');