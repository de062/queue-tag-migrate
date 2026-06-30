import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export async function signUp(email: string, password: string, businessName: string, businessCategory: string): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Set businessName as displayName in Auth Profile
  await updateProfile(user, { displayName: businessName });
  
  // Store business details in Firestore businesses collection
  await setDoc(doc(db, 'businesses', user.uid), {
    businessName,
    email,
    businessCategory,
    creationDate: new Date().toISOString()
  });
  
  return user;
}

export async function logIn(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
