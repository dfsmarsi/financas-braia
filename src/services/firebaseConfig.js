import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// SUBSTITUI COM AS TUAS CHAVES DO FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDjeACyWeUZir6oEizicQd_vzPTe_neIAE",
  authDomain: "financas-braia.firebaseapp.com",
  databaseURL: "https://financas-braia-default-rtdb.firebaseio.com",
  projectId: "financas-braia",
  storageBucket: "financas-braia.firebasestorage.app",
  messagingSenderId: "575096779882",
  appId: "1:575096779882:web:44ec453d5c99322b88c613"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);