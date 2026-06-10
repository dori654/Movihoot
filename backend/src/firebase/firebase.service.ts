import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App;

  onModuleInit() {
    if (admin.apps.length === 0) {
      try {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      } catch (err) {
        throw new Error(
          `Failed to initialize Firebase Admin SDK — check FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in backend/.env: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.app = admin.apps[0]!;
    }
  }

  get auth(): admin.auth.Auth {
    return this.app.auth();
  }

  get firestore(): admin.firestore.Firestore {
    return this.app.firestore();
  }
}
