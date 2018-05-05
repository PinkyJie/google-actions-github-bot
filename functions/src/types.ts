import {
    DialogflowConversation,
    Contexts,
} from 'actions-on-google';

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

export interface User {
    login: string,
    id: number,
    name: string,
};

export interface UserData {
    repositories: Repository[],
    currentIndex: number,
    language: string,
    period: string,
    hasRejected: boolean,
};

export type CONV_TYPE = DialogflowConversation<{}, {}, Contexts>;

export interface IntentResult {
    status: string,
}
