import {
    dialogflow,
    BasicCard,
    Suggestions,
    Button,
    DialogflowConversation,
    Contexts,
    SignIn,
} from 'actions-on-google';

import { fetchTrending, starRepository } from './github';
import { UserData, Repository } from './types';
import * as PROMPTS from './prompts';
import {
    getRepoParagraph,
    getRandomMessage,
    getRepoStartMessage,
    wrapWithSpeak,
    getStarredMessage,
} from './utils';

const INTENTS = {
    WELCOME: 'Default Welcome Intent',
    WELCOME_NO_INPUT: 'Default Welcome Intent - No Input',
    HELP: 'Help',
    FETCH_TRENDING: 'Fetch Trending',
    FETCH_TRENDING_NO_INPUT: 'Fetch Trending - No Input',
    FETCH_TRENDING_NEXT_YES: 'Fetch Trending - Yes',
    FETCH_TRENDING_NEXT_NO: 'Fetch Trending - No',
    STAR_IT: 'Fetch Trending - Star It',
    SIGN_IN_YES: 'Sign In - Yes',
    SIGN_IN_NO: 'Sign In - No',
};

const PARAMETERS = {
    LANGUAGE: 'programming_language',
};

const CONTEXTS = {
    WELCOME_FOLLOWUP: 'DefaultWelcomeIntent-followup',
    FETCH_TRENDING_FOLLOWUP: 'FetchTrending-followup',
    SIGN_IN_FOLLOWUP: 'SignIn-followup',
};
const DEFAULT_CONTEXT_LIFE_SPAN = 3;

type CONV_TYPE = DialogflowConversation<{}, {}, Contexts>;

// ACTIONS
const app = dialogflow({debug: true});

app.intent(INTENTS.WELCOME, conv => {
    conv.contexts.set(CONTEXTS.WELCOME_FOLLOWUP, DEFAULT_CONTEXT_LIFE_SPAN);
    conv.ask(getRandomMessage(PROMPTS.WELCOME_MESSAGE));
});

app.intent(INTENTS.WELCOME_NO_INPUT, conv => {
    handleReprompt(conv, PROMPTS.NO_INPUT_WELCOME);
});

app.intent(INTENTS.HELP, conv => {
    conv.ask(wrapWithSpeak([
        PROMPTS.HELP,
        PROMPTS.COMMAND_INTRODUCE,
    ]));
});

app.intent(INTENTS.FETCH_TRENDING, conv => {
    const data = conv.data as UserData;
    const { language, repositories } = data;
    const arg = conv.parameters[PARAMETERS.LANGUAGE];
    const lang = arg ? arg.toString() : '';
    let promise;
    if (repositories &&
        repositories.length > 0 &&
        language === lang
    ) {
        promise = Promise.resolve(repositories);
    } else {
        promise = fetchTrending(lang);
    }
    return promise
        .then(repos => {
            data.repositories = repos;
            data.language = lang;
            if (repos.length === 0) {
                conv.close(wrapWithSpeak([
                    PROMPTS.EMPTY_REPOSITORY,
                    getRandomMessage(PROMPTS.GOODBYE),
                ]));
            } else {
                data.currentIndex = -1;
                goToNextRepo(conv);
            }
        })
        .catch(err => {
            console.log('Error: ', err);
            conv.close(PROMPTS.NETWORK_ERROR);
        });
});

app.intent(INTENTS.FETCH_TRENDING_NEXT_YES, conv => {
    goToNextRepo(conv);
});

app.intent(INTENTS.FETCH_TRENDING_NEXT_NO, conv => {
    const data = conv.data as UserData;
    if (data.hasRejected || data.language !== '') {
        conv.close(wrapWithSpeak([
            getRandomMessage(PROMPTS.GOODBYE),
        ]));
    } else {
        data.hasRejected = true;
        conv.ask(wrapWithSpeak([
            PROMPTS.REPOSITORY_NO_MORE,
            PROMPTS.REPOSITORY_OTHER_LANGUAGE,
        ]));
    }
});

app.intent(INTENTS.FETCH_TRENDING_NO_INPUT, conv => {
    handleReprompt(conv, PROMPTS.NO_INPUT_MORE_REPOSITORIES);
});

app.intent(INTENTS.STAR_IT, conv => {
    const data = conv.data as UserData;
    const { currentIndex, repositories } = data;
    const currentRepo = repositories[currentIndex];

    const token = conv.request.user.accessToken;
    if (token) {
        return startRepo(currentRepo, conv);
    } else {
        conv.contexts.set(CONTEXTS.SIGN_IN_FOLLOWUP, 1);
        return Promise.resolve()
            .then(() => {
                conv.ask(new SignIn());
            });
    }
});

app.intent(INTENTS.SIGN_IN_YES, conv => {
    const data = conv.data as UserData;
    const { currentIndex, repositories } = data;
    const currentRepo = repositories[currentIndex];

    conv.ask(getRandomMessage(PROMPTS.SIGN_IN_YES));
    return startRepo(currentRepo, conv);
});

app.intent(INTENTS.SIGN_IN_NO, conv => {
    conv.ask(getRandomMessage(PROMPTS.SIGN_IN_NO));
});

export default app;

// Useful functions
function handleReprompt(conv: CONV_TYPE, messages) {
    const repromptCount = parseInt(conv.arguments.get('REPROMPT_COUNT'));
    const isFinalReprompt = conv.arguments.get('IS_FINAL_REPROMPT');
    if (isFinalReprompt) {
        conv.close(messages[2]);
    } else {
        conv.ask(messages[repromptCount]);
    }
}

function goToNextRepo(conv: CONV_TYPE) {
    const data = conv.data as UserData;
    const { repositories } = data;
    data.currentIndex += 1;
    const nextRepo = repositories[data.currentIndex];

    const greetingMsg = data.currentIndex === 0 ?
        getRepoStartMessage(data.language) :
        getRandomMessage(PROMPTS.REPOSITORY_NEXT_ONE);

    const cardItem = new BasicCard({
        title: `${nextRepo.author} / ${nextRepo.name}`,
        subtitle: `Stars: ${nextRepo.stars}`,
        text: nextRepo.description,
        buttons: new Button({
            title: 'Read more on Github',
            url: nextRepo.href,
        }),
    })
    conv.ask(greetingMsg);

    // if next one is the last one
    if (data.currentIndex === repositories.length - 1) {
        conv.ask(wrapWithSpeak([
            getRepoParagraph(nextRepo),
            getRandomMessage(PROMPTS.REPOSITORY_LAST_ONE),
            getRandomMessage(PROMPTS.GOODBYE),
        ]));
    } else {
        conv.contexts.set(CONTEXTS.FETCH_TRENDING_FOLLOWUP, DEFAULT_CONTEXT_LIFE_SPAN);
        conv.ask(
            new Suggestions(
                getRandomMessage(PROMPTS.REPOSITORY_NEXT_BUTTON),
                getRandomMessage(PROMPTS.REPOSITORY_STAR_BUTTON),
                getRandomMessage(PROMPTS.REPOSITORY_GOODBYE_BUTTON),
            ),
            cardItem,
        );
        conv.ask(wrapWithSpeak([
            getRepoParagraph(nextRepo),
            getRandomMessage(PROMPTS.MORE_REPOSITORIES),
        ]));
    }
}

function startRepo(repo: Repository, conv: CONV_TYPE) {
    const token = conv.request.user.accessToken;
    return starRepository(repo, token)
        .then(() => {
            conv.contexts.set(CONTEXTS.FETCH_TRENDING_FOLLOWUP, DEFAULT_CONTEXT_LIFE_SPAN);
            conv.ask(wrapWithSpeak([
                getStarredMessage(repo),
                getRandomMessage(PROMPTS.MORE_REPOSITORIES),
            ]));
        })
        .catch(err => {
            console.log('Error: ', err);
            conv.close(PROMPTS.NETWORK_ERROR);
        });
}
