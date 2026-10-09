import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCMlk9109rE9xk_wDsGqIrXF684rCOpo78",
  authDomain: "court-ou.firebaseapp.com",
  projectId: "court-ou",
  storageBucket: "court-ou.firebasestorage.app",
  messagingSenderId: "795128757517",
  appId: "1:795128757517:web:a9a1908ab4d355184c8444"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);