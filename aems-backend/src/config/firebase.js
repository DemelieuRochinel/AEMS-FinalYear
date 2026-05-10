const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 1. Clean the private key properly
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const formattedKey = rawKey ? rawKey.replace(/\\n/g, '\n').replace(/"/g, '') : undefined;

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log("Firebase Admin SDK initialized successfully!");
    
  } catch (error) {
    console.error("Firebase initialization failed:", error.message);
    process.exit(1);
  }
}

// Export the database service
module.exports = admin.database();