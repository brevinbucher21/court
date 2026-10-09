const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

exports.resetTonightAt4AM = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "America/New_York",
  },
  async () => {
    const db = getFirestore();
    const snap = await db.collection("tonight_status").get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Cleared ${snap.size} at 4am`);
  }
);