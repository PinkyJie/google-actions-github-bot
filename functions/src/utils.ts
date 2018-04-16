import { Repository } from './types';

export function getRepoParagraph(repo: Repository): string {
    const langStr = repo.language ? ` using language <emphasis>${repo.language}</emphasis>` : '';
    const description = repo.speakableDescription === '' ?
        'There is no description for this repository yet.' :
        `The description for the repository is <emphasis>${repo.speakableDescription}</emphasis>`;
    return `
        <break time="1s"/>
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
