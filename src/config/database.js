const { admin, initFirebase } = require('./firebase');
const logger = require('../utils/logger');

// Initialize Firebase Admin SDK
initFirebase();

let firestoreInstance = null;

try {
  firestoreInstance = admin.firestore();
  logger.info('Firebase Firestore initialized as primary database for Rivava Backend.');
} catch (err) {
  logger.warn(`Firestore initialization notice: ${err.message}`);
}

const firestoreDb = {
  admin,
  firestore: firestoreInstance || (admin.apps && admin.apps.length > 0 ? admin.firestore() : null),
  
  // Collections Helper References
  collection(name) {
    const fs = this.getFirestore();
    return fs.collection(name);
  },

  getFirestore() {
    if (!firestoreInstance) {
      firestoreInstance = admin.firestore();
    }
    return firestoreInstance;
  },

  // Direct collection accessors
  users() {
    return this.collection('therivdata');
  },

  payments() {
    return this.collection('payments');
  },

  secretKeys() {
    return this.collection('secret_keys');
  },

  eliteSubscriptions() {
    return this.collection('elite_subscriptions');
  }
};

module.exports = firestoreDb;
