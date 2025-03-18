
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyArCi2Sx0djkO3M7wD0X0JnkLbFh70GEOw",
  authDomain: "has-ess-2.firebaseapp.com",
  projectId: "has-ess-2",
  storageBucket: "has-ess-2.firebasestorage.app",
  messagingSenderId: "1041653137854",
  appId: "1:1041653137854:web:f852018a38ec44ba6af9ef",
  measurementId: "G-8ZMPSRNS3M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
