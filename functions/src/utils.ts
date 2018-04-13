import { Repository } from './types';

export function getRepoParagraph(repo: Repository): string {
    const langStr = repo.language ? ` using language <emphasis>${repo.language}</emphasis>` : '';
    return `
        <break time="1s"/>
        <p>
            The project named <emphasis>${repo.name}</emphasis>, which is created by <emphasis>${repo.author}</emphasis>${langStr}
        </p>
        <break time="300ms"/>
        <p>The description for the project is ${repo.speakableDescription}.</p>
        <p>
            This repository got <say-as interpret-as="cardinal">${repo.stars}</say-as> starts in total, with <say-as interpret-as="cardinal">${repo.starsToday}</say-as> of which achieved today.
        </p>
    `;
}
