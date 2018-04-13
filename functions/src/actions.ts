import { DialogflowApp } from 'actions-on-google';

import { fetchTrending } from './github';
import { UserData } from './types';
import * as PROMPTS from './prompts';
import { getRepoParagraph } from './utils';

const ACTIONS = {
    FETCH_TRENDING: 'fetch_trending',
};

const PARAMETERS = {
    LANGUAGE: 'programming_language',
};

export default class GithubBot {
    app: DialogflowApp;
    data: UserData;

    constructor (req, res) {
        console.log(`Headers: ${JSON.stringify(req.headers)}`);
        console.log(`Body: ${JSON.stringify(req.body)}`);
        this.app = new DialogflowApp({ request: req, response: res });
        this.data = this.app.data as UserData;
    }

    run () {
        const action = this.app.getIntent();
        console.log(`Parameter: ${this.app.getArgument(PARAMETERS.LANGUAGE)}`);
        console.log(`Action: ${action}`);
        if (!action) {
            this.app.ask(PROMPTS.SORRY_RESPONSE);
        } else {
            this[action]();
        }
    }

    [ACTIONS.FETCH_TRENDING] () {
        let promise;
        if (this.data.repositories) {
            promise = Promise.resolve(this.data.repositories);
        } else {
            promise = fetchTrending();
        }
        promise
            .then(repos => {
                this.data.repositories = repos;
                this.app.tell(`
                    <speak>
                        ${PROMPTS.REPOSITORY_START}
                        <break />
                        ${getRepoParagraph(repos[0])}
                    </speak>
                `);
            })
            .catch(err => {
                console.log('Error: ', err);
                this.app.tell(PROMPTS.NETWORK_ERROR);
            });
    }
}
