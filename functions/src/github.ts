import axios from 'axios';
import * as cheerio from 'cheerio';

import { Repository, User } from './types';

export function fetchTrending(
    lang: string = '',
    since: string = 'daily',
) {
    const url = `https://github.com/trending/${encodeURIComponent(lang)}?since=${since}`;
    return axios.get(url)
        .then(response => {
            const $ = cheerio.load(response.data);
            const repos = [];
            const list = $('ol.repo-list');

            list.children().each((index, repo) => {
                const title = $(repo).find('h3').text().trim();
                const [author, name] = title.split(' / ');

                const starSVGs = $(repo).find('.octicon.octicon-star');
                const stars = $(starSVGs.get(1)).parent()
                    .text().trim()
                    .replace(',', '');
                const starsToday = $(starSVGs.get(2)).parent()
                    .text().trim()
                    // 3,960 stars today/this week/month
                    .replace(/ stars .+/, '')
                    .replace(',', '');
                const description = $(repo).find('.py-1 p');
                const fullDescription = description.text().trim();
                let speakableDescription;
                if (fullDescription === '') {
                    speakableDescription = '';
                } else {
                    speakableDescription = description[0].childNodes
                        .filter(node => node.type === 'text')
                        .map(node => node.nodeValue.trim())
                        .join('');
                }

                repos.push({
                    author,
                    name,
                    href: 'https://github.com/' + title.replace(/ /g, ''),
                    description: fullDescription,
                    speakableDescription,
                    language: $(repo).find('[itemprop=programmingLanguage]').text().trim(),
                    stars: parseInt(stars) || 0,
                    starsToday: parseInt(starsToday) || 0,
                } as Repository);
            });
            return repos;
        });
}

export function starRepository(repo: Repository, token: string) {
    const url = `https://api.github.com/user/starred/${repo.author}/${repo.name}`;
    return axios.put(url, null, {
        headers: {
            Authorization: `token ${token}`,
        },
    });
}

export function getUserInfo(token: string) {
    const url = `https://api.github.com/user`;
    return axios.get(url, {
        headers: {
            Authorization: `token ${token}`,
        },
    }).then(response => {
        return response.data as User;
    });
}
