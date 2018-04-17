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

    clearData() {
        this.data.currentIndex = -1;
        this.data.repositories = [];
        this.app.setContext('');
    }

    nextRepo() {
        const { repositories } = this.data;
        this.data.currentIndex += 1;
        const nextRepo = repositories[this.data.currentIndex];

        const greetingMsg = this.data.currentIndex === 0 ?
            PROMPTS.REPOSITORY_START :
            getRandomMessage(PROMPTS.REPOSITORY_NEXT_ONE);

        const audioResponse = [
            getRepoParagraph(nextRepo),
        ];
        const cardItem = this.app.buildBasicCard(nextRepo.description)
            .setTitle(`${nextRepo.author} / ${nextRepo.name}`)
            .setSubtitle(`Stars: ${nextRepo.stars}`)
            .addButton('Read more on Github', nextRepo.href);
        const response = this.app.buildRichResponse()
            .addSimpleResponse(greetingMsg)
            .addBasicCard(cardItem);

        let method;
        // if next one is the last one
        if (this.data.currentIndex === repositories.length - 1) {
            this.clearData();
            audioResponse.push(getRandomMessage(PROMPTS.REPOSITORY_LAST_ONE));
            audioResponse.push(getRandomMessage(PROMPTS.GOODBYE));
            method = 'tell';
        } else {
            this.app.setContext(CONTEXTS.FETCH_TRENDING_FOLLOWUP, 2);
            audioResponse.push(getRandomMessage(PROMPTS.MORE_REPOSITORIES));
            response.addSuggestions([
                getRandomMessage(PROMPTS.REPOSITORY_NEXT_BUTTON),
                getRandomMessage(PROMPTS.REPOSITORY_GOODBYE_BUTTON),
            ]);
            method = 'ask';
        }
        response.addSimpleResponse([
            '<speak>',
                ...audioResponse,
            '</speak>',
        ].join('<break />'));

        this.app[method](response);
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
                if (repos.length === 0) {
                    this.app.tell([
                        '<speak>',
                            PROMPTS.EMPTY_REPOSITORY,
                            '<break />',
                            getRandomMessage(PROMPTS.GOODBYE),
                        '</speak>',
                    ].join(''));
                } else {
                    this.data.currentIndex = -1;
                    this.nextRepo();
                }
            })
            .catch(err => {
                console.log('Error: ', err);
                this.app.tell(PROMPTS.NETWORK_ERROR);
            });
    }

    [ACTIONS.FETCH_TRENDING_NEXT_YES] () {
        this.nextRepo();
    }

    [ACTIONS.FETCH_TRENDING_NEXT_NO] () {
        this.clearData();
        this.app.tell([
            '<speak>',
                PROMPTS.REPOSITORY_NO_MORE,
                getRandomMessage(PROMPTS.GOODBYE),
            '</speak>',
        ].join('<break />'));
    }
}
