import { getApp } from '@firebase/app';
import { getFirestore, collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp } from '@firebase/firestore';

// Not enabled until the two members and database rules have been provisioned.
export function connectRecords(spaceId, userId, receive, failure) {
  if (!spaceId || !userId) throw new Error('Entre para sincronizar.');
  const db = getFirestore(getApp());
  const records = collection(db, 'spaces', spaceId, 'entries');
  const own = new Map(), shared = new Map();
  const publish = () => receive([...new Map([...shared, ...own]).values()]);
  const listen = (filter, target) => onSnapshot(query(records, filter), snapshot => {
    target.clear();
    for (const record of snapshot.docs) target.set(record.id, { ...record.data(), id: record.id });
    publish();
  }, failure);
  const stopOwn = listen(where('authorId', '==', userId), own);
  const stopShared = listen(where('shared', '==', true), shared);
  return {
    async save(record) {
      if (!record.id || (record.authorId && record.authorId !== userId))
        throw new Error('Você só pode alterar seus próprios registros.');
      const clean = JSON.parse(JSON.stringify(record));
      // This promise resolves only after acknowledgement from the server.
      await setDoc(doc(records, record.id), {
        ...clean, authorId: userId, shared: record.shared === true,
        updatedAt: serverTimestamp(),
      });
    },
    async remove(id) { await deleteDoc(doc(records, id)); },
    close() { stopOwn(); stopShared(); own.clear(); shared.clear(); },
  };
}
