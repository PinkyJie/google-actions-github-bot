import { DialogflowApp } from 'actions-on-google';

import { fetchTrending } from './github';
import { UserData } from './types';
import * as PROMPTS from './prompts';
import { getRepoParagraph, getRandomMessage } from './utils';

const ACTIONS = {
    FETCH_TRENDING: 'fetch_trending',
    FETCH_TRENDING_NEXT_YES: 'fetch_trending.fetch_trending-yes',
    FETCH_TRENDING_NEXT_NO: 'fetch_trending.fetch_trending-no',
};

const PARAMETERS = {
    LANGUAGE: 'programming_language',
};

const CONTEXTS = {
    FETCH_TRENDING_FOLLOWUP: 'fetch_trending-followup',
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

    tellNextRepo() {
        const { currentIndex, repositories } = this.data;
        this.data.currentIndex += 1;
        const greetingMsg = this.data.currentIndex === 0 ?
            PROMPTS.REPOSITORY_START :
            getRandomMessage(PROMPTS.REPOSITORY_NEXT_ONE);
        // if next one is the last one
        if (this.data.currentIndex === repositories.length - 1) {
            this.app.tell(`
                <speak>
                    ${greetingMsg}
                    ${getRepoParagraph(repositories[this.data.currentIndex])}
                    <break />
                    ${getRandomMessage(PROMPTS.REPOSITORY_LAST_ONE)}
                    ${getRandomMessage(PROMPTS.GOODBYE)}
                </speak>
            `);
        } else {
            this.app.setContext(CONTEXTS.FETCH_TRENDING_FOLLOWUP, 2);
            this.app.ask(`
                <speak>
                    ${greetingMsg}
                    ${getRepoParagraph(repositories[this.data.currentIndex])}
                    <break />
                    ${getRandomMessage(PROMPTS.MORE_REPOSITORIES)}
                </speak>
            `);
        }
    }

    [ACTIONS.FETCH_TRENDING] () {
        let promise;
        if (this.data.repositories && this.data.repositories.length > 0) {
            promise = Promise.resolve(this.data.repositories);
        } else {
            promise = fetchTrending();
        }
        promise
            .then(repos => {
                this.data.repositories = repos;
                this.data.currentIndex = -1;
                if (repos.length === 0) {
                    this.app.tell(`
                        <speak>
                            ${PROMPTS.EMPTY_REPOSITORY}
                            <break />
                            ${getRandomMessage(PROMPTS.GOODBYE)}
                        </speak>
                    `);
                } else {
                    this.tellNextRepo();
                }
            })
            .catch(err => {
                console.log('Error: ', err);
                this.app.tell(PROMPTS.NETWORK_ERROR);
            });
    }

    [ACTIONS.FETCH_TRENDING_NEXT_YES] () {
        this.tellNextRepo();
    }

    [ACTIONS.FETCH_TRENDING_NEXT_NO] () {
        this.data.currentIndex = 0;
        this.data.repositories = [];
        this.app.tell(`
            <speak>
                ${PROMPTS.REPOSITORY_NO_MORE}
                <break />
                ${getRandomMessage(PROMPTS.GOODBYE)}
            </speak>
        `);
    }
}
