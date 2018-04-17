export interface Repository {
    author: string,
    name: string,
    href: string,
    description: string,
    speakableDescription: string,
    language: string,
    stars: number,
    starsToday: number,
};

export interface UserData {
    repositories: Repository[],
    currentIndex: number,
    language: string,
    hasRejected: boolean,
};
