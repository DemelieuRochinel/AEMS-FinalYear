
// // Initialize Firebase
// const app = initializeApp(firebaseConfig);


import { initializeApp } from "firebase/app";
// 1. Import the specific Firebase services you need
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBTxplf0n_KgIp-N-BEd2Awz5RQpkWtO2A",
  authDomain: "aems-finalyear-cameroon.firebaseapp.com",
  databaseURL: "https://aems-finalyear-cameroon-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "aems-finalyear-cameroon",
  storageBucket: "aems-finalyear-cameroon.firebasestorage.app",
  messagingSenderId: "60682122329",
  appId: "..." // (Make sure your appId is completely filled out here)
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Pass the 'app' variable into your services (this uses 'app' and clears the ESLint warning!)
const auth = getAuth(app);
const database = getDatabase(app);

// 3. Export them so your route files can use them
export { auth, database };