import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyDsD8Kjj6fMpANfPeG_Oe9Kt9-hGKH57So",
  authDomain: "sonesta-msg-viewer.firebaseapp.com",
  projectId: "sonesta-msg-viewer",
  storageBucket: "sonesta-msg-viewer.firebasestorage.app",
  messagingSenderId: "255873328769",
  appId: "1:255873328769:web:e6ca6cbdf8449e65908f80"
};

export const app = initializeApp(firebaseConfig);
