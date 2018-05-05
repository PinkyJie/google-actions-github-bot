import { Repository, User } from './types';

export function getRepoParagraph(repo: Repository): string {
    const langStr = repo.language ? ` using language <emphasis>${repo.language}</emphasis>` : '';
    const description = repo.speakableDescription === '' ?
        'There is no description for this repository yet.' :
        `The description for the repository is <emphasis>${repo.speakableDescription}</emphasis>`;
    return `
        <p>
            The repository named <emphasis>${repo.name}</emphasis>, which is created by <emphasis>${repo.author}</emphasis>${langStr}
        </p>
        <break time="300ms"/>
        <p>${description}</p>
        <p>
            This repository got <say-as interpret-as="cardinal">${repo.stars}</say-as> stars in total, with <say-as interpret-as="cardinal">${repo.starsToday}</say-as> stars achieved today.
        </p>
    `;
}

export function getRandomMessage(messages: string[]) {
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}

export function getRepoStartMessage(language, period) {
    const str1 = 'Sure! Here are the trending repositories';
    const str2 = `on Github`;
    let periodText;
    switch (period) {
        case 'daily':
            periodText = 'today';
            break;
        case 'weekly':
            periodText = 'in this week';
            break;
        case 'monthly':
            periodText = 'in this month';
            break;
        default:
            periodText = 'today';
    }
    if (language === '') {
        return `${str1} ${str2} ${periodText}.`;
    }
    return `${str1} for ${language} ${str2} ${periodText}.`;
}

export function wrapWithSpeak(array) {
    return [
        '<speak>',
            ...array,
        '</speak>'
    ].join('<break />');
}

export function getStarredMessage(repo: Repository) {
    const messages = [
        `Cool! Repository ${repo.name} is already starred for you on Github.`,
        `Done! Repository ${repo.name} is in your star list on Github.`,
        `Alright! Repository ${repo.name} is starred, go to Github and check it out.`,
    ];
    return getRandomMessage(messages);
}

export function getAccountLinkedMessage(user: User) {
    const messages = [
        `Cool! ${user.name}, your Github account ${user.login} is already linked. I\'ll star the repository for you!`,
        `Nice! ${user.name}, github account ${user.login} is linked successfully. Let me star that repository for you.`,
        `Bravo! ${user.name}, github account ${user.login} linked! You\'ve unlocked new feature from Github Trending. Now I\'ll star that repository.`,
    ];
    return getRandomMessage(messages);
}
