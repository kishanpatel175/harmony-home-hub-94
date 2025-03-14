
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBOd5YPabaKSXcM44vyimxMNjXAOcc5cOA",
  authDomain: "has-ess.firebaseapp.com",
  projectId: "has-ess",
  storageBucket: "has-ess.firebasestorage.app",
  messagingSenderId: "640421935619",
  appId: "1:640421935619:web:a15527483c2af6fcda6c36",
  measurementId: "G-JDSRLX1ERY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
