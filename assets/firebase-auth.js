import { initializeApp } from '@firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from '@firebase/auth';

// Public Firebase configuration. Access to records must be enforced by database rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyD-AUDUUSuqpNKKeRHKmaBAxWaTPLtMYTk',
  authDomain: 'nosso-canto-19a39.firebaseapp.com',
  projectId: 'nosso-canto-19a39',
  appId: '1:30233589779:web:a6624c020356f754fae7e6',
};
let client;
export function firebaseAdapter() {
  client ||= initializeAuth(initializeApp(firebaseConfig), {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  const userInfo = u => u ? { id: u.uid, email: u.email, user_metadata: { full_name: u.displayName, avatar_url: u.photoURL } } : null;
  const session = async () => {
    await client.authStateReady();
    const u = client.currentUser;
    return u ? { user: userInfo(u), access_token: await u.getIdToken() } : null;
  };
  return { auth: {
    getSession: async () => ({ data: { session: await session() } }),
    getUser: async () => ({ data: { user: (await session())?.user || null } }),
    signInWithOAuth: async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(client, provider);
      return { error: null };
    },
    signOut: async () => { await signOut(client); return { error: null }; },
    onAuthStateChange: callback => {
      let initialized = false;
      const unsubscribe = onAuthStateChanged(client, u => {
        if (initialized) callback(u ? 'SIGNED_IN' : 'SIGNED_OUT');
        initialized = true;
      });
      return { data: { subscription: { unsubscribe } } };
    },
  }};
}
