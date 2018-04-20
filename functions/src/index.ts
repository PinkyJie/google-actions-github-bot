import * as functions from 'firebase-functions';
import app from './actions';

export const githubBot = functions.https.onRequest(app);
