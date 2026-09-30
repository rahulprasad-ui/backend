const admin = require('firebase-admin');
const fs = require('fs');
const config = require('./env');
const logger = require('../utils/logger');

let isInitialized = false;

function initFirebase() {
  if (isInitialized) {
    return { admin };
  }

  try {
    // 1. Direct JSON from environment variable (Best for Render/Cloud platforms)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      logger.info('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT_JSON.');
      isInitialized = true;
      return { admin };
    }

    // 2. Physical serviceAccountKey.json file
    if (config.firebase.serviceAccountPath && fs.existsSync(config.firebase.serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(config.firebase.serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      logger.info('Firebase Admin initialized with service account key file.');
      isInitialized = true;
      return { admin };
    }

    // 3. Fallback: Project ID initialization
    const projectId = config.firebase.projectId || process.env.FIREBASE_PROJECT_ID || 'rivavatrackfi';
    admin.initializeApp({
      projectId
    });
    logger.info(`Firebase Admin initialized with Project ID: ${projectId}`);
    isInitialized = true;
  } catch (error) {
    logger.warn(`Firebase Admin initialization notice: ${error.message}`);
  }

  return { admin };
}

initFirebase();

module.exports = { admin, initFirebase };
