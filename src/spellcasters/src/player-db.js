import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApUmQPCgluD8YFBmuyqJmeNtbzHQmdTlo",
  authDomain: "spellcasters-b7154.firebaseapp.com",
  projectId: "spellcasters-b7154",
  storageBucket: "spellcasters-b7154.firebasestorage.app",
  messagingSenderId: "67384342350",
  appId: "1:67384342350:web:089bd6200216d34ad4d01f",
  measurementId: "G-NFLJ2L0JHF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);// Import the functions you need from the SDKs you need

// Salva dati player
async function savePlayerToDB(player) {
  await setDoc(doc(db, "players", player.username), player);
}

// Carica dati player
export async function loadPlayerFromDB(username) {
  if (!username) return null;
  const docSnap = await getDoc(doc(db, "players", username));
  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    return null;
  }
}

function getCurrentUsername() {
  return localStorage.getItem('currentPlayer');
}

export async function getPlayerData(username) {
  if (!username) return null;
  return await loadPlayerFromDB(username);
}

export async function savePlayerData(username, data) {
  if (!username) return;
  let player = await loadPlayerFromDB(username);
  if (!player) {
    // Qui puoi inizializzare tutti i campi di default!
    player = {
      username,
      esperienza: 0,
      livello: 1,
      affinita: {},
      proiezioniUsate: {},
      mana: 0,
      manaMax: 10, // o la funzione che calcola il mana massimo
      vittorie: 0,
      partite: 0,
      magie: [],
      predisposizione: {}
    };
  }
  // Aggiorna solo le proprietà passate, ma mantieni tutte le altre
  Object.assign(player, data);
  await setDoc(doc(db, "players", username), player);
}