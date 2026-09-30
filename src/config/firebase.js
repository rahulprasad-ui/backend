const admin = require('firebase-admin');
const fs = require('fs');
const config = require('./env');
const logger = require('../utils/logger');

let isInitialized = false;

function initFirebase() {
  if (isInitialized) {
    return { admin, db: admin.firestore() };
  }

  try {
    if (fs.existsSync(config.firebase.serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(config.firebase.serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      logger.info('Firebase Admin initialized with service account key.');
    } else {
      logger.warn(`serviceAccountKey.json not found at: ${config.firebase.serviceAccountPath}. Initializing with projectId.`);
      admin.initializeApp({
        projectId: config.firebase.projectId || 'rivava-signin'
      });
    }
    isInitialized = true;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    // Do not crash immediately in dev to allow tests/health endpoints
    if (config.env === 'production') {
      throw error;
    }
  }

  const db = admin.firestore();
  return { admin, db };
}

const { db } = initFirebase();

module.exports = { admin, db, initFirebase };
