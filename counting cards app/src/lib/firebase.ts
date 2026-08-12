import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Real project — same one the live vanilla app uses. Keeping the compat (namespaced)
// SDK rather than migrating to the modular SDK, per the rewrite plan: this is a visual
// rewrite, not a backend one, so the Firebase interaction code is ported near-verbatim
// rather than rewritten against a different API.
const firebaseConfig = {
  apiKey: 'AIzaSyAKjpkly-sczi0pkHGBie3ln255dN7iyF0',
  authDomain: 'countdraculacards.firebaseapp.com',
  projectId: 'countdraculacards',
  storageBucket: 'countdraculacards.firebasestorage.app',
  messagingSenderId: '816463243138',
  appId: '1:816463243138:web:b1f345db4fda7e6dec119b'
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const fdb = firebase.firestore();
export { firebase };
