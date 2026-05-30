window.firebaseInitialized = false;
let firebaseInitAttempts = 0;

const firebaseConfig = {
  apiKey: "",
  authDomain: "better-boop.firebaseapp.com",
  projectId: "better-boop",
  storageBucket: "better-boop.firebasestorage.app",
  messagingSenderId: "1061972520477",
  appId: "1:1061972520477:web:1008242b59a60d0400a0f4",
  measurementId: "G-2NBHSC2B43"
};

function tryInitializeFirebase() {
  firebaseInitAttempts++;
  
  if (window._x && window._k) {
    firebaseConfig.apiKey = window._k;
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      try {
        const app = firebase.initializeApp(firebaseConfig);
        window.firebaseDB = firebase.database(app);
        window.firebaseInitialized = true;
      } catch (error) {
        window.firebaseInitialized = false;
      }
    }
    return;
  }
  
  if (firebaseInitAttempts < 200) {
    setTimeout(tryInitializeFirebase, 50);
  } else {
    window.firebaseInitialized = false;
  }
}

tryInitializeFirebase();
