import {
    dialogflow,
    BasicCard,
    Suggestions,
    Button,
    SignIn,
    NewSurface,
} from 'actions-on-google';

import { fetchTrending, starRepository, getUserInfo } from './github';
import { UserData, Repository, CONV_TYPE, IntentResult } from './types';
import * as PROMPTS from './prompts';
import {
    getRepoParagraph,
    getRandomMessage,
    getRepoStartMessage,
    wrapWithSpeak,
    getStarredMessage,
    getAccountLinkedMessage,
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
    SIGN_IN_RESULT: 'Sign In - Result',
    NEW_SURFACE_RESULT: 'New Surface - Result',
};

const PARAMETERS = {
    LANGUAGE: 'programming_language',
};

const CONTEXTS = {
    WELCOME_FOLLOWUP: 'DefaultWelcomeIntent-followup',
    FETCH_TRENDING_FOLLOWUP: 'FetchTrending-followup',
};
const DEFAULT_CONTEXT_LIFE_SPAN = 3;
const SIGN_SURFACE_CAPABILITY = 'actions.capability.SCREEN_OUTPUT';

// ACTIONS
const app = dialogflow({debug: true});

app.intent(INTENTS.WELCOME, conv => {
    conv.contexts.set(CONTEXTS.WELCOME_FOLLOWUP, DEFAULT_CONTEXT_LIFE_SPAN);
    conv.ask(getRandomMessage(PROMPTS.WELCOME_MESSAGE), new Suggestions(
        'Tell me the trending repositories',
        'Trending for Javascript',
        'I need some help',
    ));
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

    const token = conv.user.access.token;
    if (token) {
        return startRepo(currentRepo, conv);
    } else {
        return handleSignIn(conv);
    }
});

app.intent(INTENTS.SIGN_IN_RESULT, (conv, params, signInResult) => {
    const status = (signInResult as IntentResult).status;
    console.log('sign in result: ', status);
    if (status !== 'OK') {
        conv.contexts.set(CONTEXTS.FETCH_TRENDING_FOLLOWUP, DEFAULT_CONTEXT_LIFE_SPAN);
        return conv.ask(getRandomMessage(PROMPTS.SIGN_IN_NO));
    }

    const data = conv.data as UserData;
    const { currentIndex, repositories } = data;
    const currentRepo = repositories[currentIndex];

    return getUserInfo(conv.user.access.token)
        .then(user => {
            conv.ask(getAccountLinkedMessage(user));
            return startRepo(currentRepo, conv);
        });
});

app.intent(INTENTS.NEW_SURFACE_RESULT, (conv, params, newSurfaceResult) => {
    const status = (newSurfaceResult as IntentResult).status;
    console.log('new surface result: ', status);
    if (status === 'OK') {
        return conv.ask(new SignIn());
    } else {
        return conv.ask(PROMPTS.SIGN_IN_TRANSFER_NO);
    }
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
        const askForStarOrForNext = Math.random() > 0.5;
        conv.ask(wrapWithSpeak([
            getRepoParagraph(nextRepo),
            askForStarOrForNext ?
                getRandomMessage(PROMPTS.ASK_FOR_NEXT_REPOSITORIES) :
                getRandomMessage(PROMPTS.ASK_FOR_STAR_REPOSITORY),
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
                getRandomMessage(PROMPTS.ASK_FOR_NEXT_REPOSITORIES),
            ]));
        })
        .catch(err => {
            console.log('Error: ', err);
            conv.close(PROMPTS.NETWORK_ERROR);
        });
}

function handleSignIn(conv: CONV_TYPE) {
    const hasScreen = conv.surface.capabilities.has(SIGN_SURFACE_CAPABILITY);
    if (hasScreen) {
        return conv.ask(new SignIn());
    }
    const screenAvailable = conv.available.surfaces.capabilities.has(SIGN_SURFACE_CAPABILITY);
    if (screenAvailable) {
        return conv.ask(new NewSurface({
            context: PROMPTS.SIGN_IN_ASK_FOR_TRANSFER,
            notification: 'Link Github to star a repository',
            capabilities: SIGN_SURFACE_CAPABILITY
        }));
    } else {
        conv.contexts.set(CONTEXTS.FETCH_TRENDING_FOLLOWUP, DEFAULT_CONTEXT_LIFE_SPAN);
        return conv.ask(PROMPTS.SIGN_IN_NOT_SUPPORTED);
    };
}
