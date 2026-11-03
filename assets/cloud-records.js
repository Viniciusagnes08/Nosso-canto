import { getApp } from "@firebase/app";
import { getFirestore, collection, doc, query, where, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, writeBatch, serverTimestamp } from "@firebase/firestore";
import { mediaGet, mediaPut } from "./media.js";
import { cleanProfile } from "./reels-model.js";
import { selectUnpublishedLegacy, visibleSnapshotVersion } from "./core/sync-policy.js";

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
  if (record.photoId && record.photoData) {
    // Photos from either member must be present locally to render across devices.
    // Repeated Firestore listener notifications must not rewrite the same blob.
    const alreadyCached = await mediaGet(record.photoId).catch(() => null);
    if (!alreadyCached) await mediaPut(record.photoId, await dataUrlToBlob(record.photoData));
  }
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
  // Legacy import is create-only: a stale copy on this phone cannot clobber a
  // fresher entry that another device already synchronized to Firestore.
  // A single query is cheaper than one getDoc call per historical record.
  const existing = await getDocs(query(records, where("authorId", "==", userId)));
  if (initialRecords.length) {
    const existingIds = new Set(existing.docs.map(entry => entry.id));
    const seed = selectUnpublishedLegacy(initialRecords, existingIds, userId);
    for (const record of seed) {
      const selected = ["event", "music"].includes(record.type) && record.sharingSelected !== true
        ? { ...record, shared: false }
        : record;
      await setDoc(doc(records, record.id), await serialize(selected, userId));
    }
  }
  // Older releases shared every imported event and song. Return those to their
  // author before listeners publish them; explicitly selected items stay shared.
  const oldShared = existing.docs.filter(entry =>
    ["event", "music"].includes(entry.data().type) && entry.data().shared === true && entry.data().sharingSelected !== true,
  );
  for (let i = 0; i < oldShared.length; i += 400) {
    const batch = writeBatch(db);
    for (const entry of oldShared.slice(i, i + 400)) batch.update(entry.ref, { shared: false, updatedAt: serverTimestamp() });
    await batch.commit();
  }
  const own = new Map(), shared = new Map();
  let publishing = Promise.resolve();
  let deliveredVersion = "";
  const publish = () => {
    const snapshot = [...new Map([...shared, ...own]).values()].filter(
      row => row.type !== "reel" && row.type !== "universe",
    );
    const version = visibleSnapshotVersion(snapshot);
    // Both onSnapshot subscriptions often return the same document list.
    // Skip equivalent snapshots to avoid decoding dozens of photos twice.
    if (version === deliveredVersion) return;
    deliveredVersion = version;
    publishing = publishing
      .then(async () => receive(await Promise.all(snapshot.map(row => hydrate(row, userId)))))
      .catch(error => {
        deliveredVersion = "";
        failure(error);
      });
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



