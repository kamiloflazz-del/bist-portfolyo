import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCluRULz8eyPBYyOjPrnpi3_STPIblFd3s",
  authDomain: "bist-portfolyo.firebaseapp.com",
  projectId: "bist-portfolyo",
  storageBucket: "bist-portfolyo.firebasestorage.app",
  messagingSenderId: "902542007663",
  appId: "1:902542007663:web:731ddd455a01ac2b03dc9a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };