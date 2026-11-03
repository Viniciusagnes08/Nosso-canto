import { getApp } from "@firebase/app";
import { getFirestore, collection, doc, query, where, onSnapshot, setDoc, deleteDoc, getDoc, serverTimestamp } from "@firebase/firestore";
import { mediaGet, mediaPut } from "./media.js";
import { cleanProfile } from "./reels-model.js";

const SPACE_ID = "nosso-canto";
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});
async function dataUrlToBlob(value) {
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
    throw new Error("Imagem recebida em formato inválido.");
  return (await fetch(value)).blob();
}
async function serialize(record, userId) {
  if (!record.id || (record.authorId && record.authorId !== userId))
    throw new Error("Você só pode alterar seus próprios registros.");
  const clean = JSON.parse(JSON.stringify(record));
  delete clean.owner;
  delete clean.updatedAt;
  if (clean.photoId) {
    const blob = await mediaGet(clean.photoId);
    if (blob) {
      const photoData = await blobToDataUrl(blob);
      if (photoData.length > 800000)
        throw new Error("A foto ficou grande demais para sincronizar.");
      clean.photoData = photoData;
    }
  }
  return { ...clean, authorId: userId, shared: clean.shared === true, updatedAt: serverTimestamp() };
}
async function hydrate(raw, userId) {
  const record = { ...raw, owner: raw.authorId === userId ? "self" : "partner" };
  if (record.photoId && record.photoData)
    await mediaPut(record.photoId, await dataUrlToBlob(record.photoData));
  delete record.photoData;
  delete record.updatedAt;
  return record;
}
export async function connectRecords(userId, initialRecords, receive, failure, initialProfile, receiveProfile) {
  if (!userId) throw new Error("Entre para sincronizar.");
  const db = getFirestore(getApp());
  const records = collection(db, "spaces", SPACE_ID, "entries");
  const profileRef = doc(db, "spaces", SPACE_ID, "profiles", userId);
  const storedProfile = await getDoc(profileRef);
  if (storedProfile.exists()) receiveProfile(cleanProfile(storedProfile.data()));
  else await setDoc(profileRef, { ...cleanProfile(initialProfile), authorId: userId, updatedAt: serverTimestamp() });
  for (const record of initialRecords.filter((item) => !item.authorId || item.authorId === userId))
    await setDoc(doc(records, record.id), await serialize(record, userId), { merge: true });
  const own = new Map(), shared = new Map();
  let publishing = Promise.resolve();
  const publish = () => {
    const snapshot = [...new Map([...shared, ...own]).values()].filter(
      row => row.type !== "reel" && row.type !== "universe",
    );
    publishing = publishing.then(async () => receive(await Promise.all(snapshot.map((row) => hydrate(row, userId))))).catch(failure);
  };
  const listen = (filter, target) => onSnapshot(query(records, filter), (snapshot) => {
    target.clear();
    for (const record of snapshot.docs) target.set(record.id, { ...record.data(), id: record.id });
    publish();
  }, failure);
  const stopOwn = listen(where("authorId", "==", userId), own);
  const stopShared = listen(where("shared", "==", true), shared);
  const stopProfile = onSnapshot(profileRef, (snapshot) => {
    if (snapshot.exists()) receiveProfile(cleanProfile(snapshot.data()));
  }, failure);
  return {
    async save(record) { await setDoc(doc(records, record.id), await serialize(record, userId)); },
    async saveProfile(profile) {
      await setDoc(profileRef, { ...cleanProfile(profile), authorId: userId, updatedAt: serverTimestamp() });
    },
    async remove(id) { await deleteDoc(doc(records, id)); },
    close() { stopOwn(); stopShared(); stopProfile(); own.clear(); shared.clear(); },
  };
}


