import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCRxmUBh2v-WmrJBQm5cAlOAhyqFx6tx2Q",
  authDomain: "clinic-app-ec730.firebaseapp.com",
  projectId: "clinic-app-ec730",
  storageBucket: "clinic-app-ec730.firebasestorage.app",
  messagingSenderId: "199786317885",
  appId: "1:199786317885:web:c2d3106ac24acdbae1c254"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);