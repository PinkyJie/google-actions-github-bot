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
    hasScreen: boolean;
    hasAudio: boolean;

    constructor (req, res) {
        console.log(`Headers: ${JSON.stringify(req.headers)}`);
        console.log(`Body: ${JSON.stringify(req.body)}`);
        this.app = new DialogflowApp({ request: req, response: res });
        this.data = this.app.data as UserData;
        const { SCREEN_OUTPUT, AUDIO_OUTPUT } = this.app.SurfaceCapabilities;
        this.hasScreen = this.app.hasSurfaceCapability(SCREEN_OUTPUT);
        this.hasAudio = this.app.hasSurfaceCapability(AUDIO_OUTPUT);
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
        this.data.textIndex = 0;
        this.data.audioIndex = 0;
        this.data.repositories = [];
        this.app.setContext('');
    }

    tellNextRepo() {
        const { repositories } = this.data;
        this.data.audioIndex += 1;
        const greetingMsg = this.data.audioIndex === 0 ?
            PROMPTS.REPOSITORY_START :
            getRandomMessage(PROMPTS.REPOSITORY_NEXT_ONE);
        // if next one is the last one
        if (this.data.audioIndex === repositories.length - 1) {
            this.app.tell(`
                <speak>
                    ${greetingMsg}
                    ${getRepoParagraph(repositories[this.data.audioIndex])}
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
                    ${getRepoParagraph(repositories[this.data.audioIndex])}
                    <break />
                    ${getRandomMessage(PROMPTS.MORE_REPOSITORIES)}
                </speak>
            `);
        }
    }

    showRepoCarousel(count = 5) {
        const { textIndex, repositories } = this.data;
        const repos = repositories.slice(textIndex, textIndex + count);
        const items = repos.map(repo =>
            this.app.buildBrowseItem(`${repo.author} / ${repo.name}`, repo.href)
                .setDescription(repo.description)
                .setFooter(`Stars: ${repo.stars}`)
        );
        const carousel = this.app.buildBrowseCarousel()
            .addItems(items);

        let greetingMsg;
        if (textIndex === 0) {
            greetingMsg = PROMPTS.REPOSITORY_START;
        } else {
            greetingMsg = getRandomMessage(PROMPTS.REPOSITORY_LOAD_MORE);
        }
        this.data.textIndex = textIndex + count;
        const response = this.app.buildRichResponse()
            .addSimpleResponse(greetingMsg)
            .addBrowseCarousel(carousel);
        if (this.data.textIndex < repositories.length) {
            response.addSuggestions(['Load more']);
            this.app.setContext(CONTEXTS.FETCH_TRENDING_FOLLOWUP, 2);
            this.app.ask(response);
        } else {
            response.addSimpleResponse(`
                <speak>
                    ${getRandomMessage(PROMPTS.REPOSITORY_LAST_ONE)}
                    ${getRandomMessage(PROMPTS.GOODBYE)}
                </speak>
            `);
            this.app.tell(response);
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
                if (repos.length === 0) {
                    this.app.tell(`
                        <speak>
                            ${PROMPTS.EMPTY_REPOSITORY}
                            <break />
                            ${getRandomMessage(PROMPTS.GOODBYE)}
                        </speak>
                    `);
                } else {
                    if (this.hasScreen) {
                        this.data.textIndex = 0;
                        this.showRepoCarousel();
                    } else if (this.hasAudio) {
                        this.data.audioIndex = -1;
                        this.tellNextRepo();
                    }
                }
            })
            .catch(err => {
                console.log('Error: ', err);
                this.app.tell(PROMPTS.NETWORK_ERROR);
            });
    }

    [ACTIONS.FETCH_TRENDING_NEXT_YES] () {
        if (this.hasScreen) {
            this.showRepoCarousel();
        } else if (this.hasAudio) {
            this.tellNextRepo();
        }
    }

    [ACTIONS.FETCH_TRENDING_NEXT_NO] () {
        this.clearData();
        this.app.tell(`
            <speak>
                ${PROMPTS.REPOSITORY_NO_MORE}
                <break />
                ${getRandomMessage(PROMPTS.GOODBYE)}
            </speak>
        `);
    }
}
