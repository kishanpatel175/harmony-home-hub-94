
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, analytics };
