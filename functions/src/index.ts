import * as functions from 'firebase-functions';
import GithubBot from './actions';

process.env.DEBUG = 'actions-on-google:*';

export const githubBot = functions.https.onRequest((req, res) =>
    new GithubBot(req, res).run()
);
