import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAuw66NIMFbT1LKnBiY-9ZpbWKnTdc1FIo",
  authDomain: "kozosapp.firebaseapp.com",
  databaseURL: "https://kozosapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kozosapp",
  storageBucket: "kozosapp.firebasestorage.app",
  messagingSenderId: "825705384716",
  appId: "1:825705384716:web:7dc2bb4124cb757e101729",
  measurementId: "G-QZB4PPRFH6",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const realtimeDb = getDatabase(app);
