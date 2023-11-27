export class MCQQuestion {
    constructor(title, answer, imageUrl) {
        this.title = title;
        this.answer = answer;
        this.imageUrl = imageUrl;
    }

    toFireFormat() {
        // id is not needed since we use Firebase 'push' which will generate one
        return {
            answer: this.answer,
            imageUrl: this.imageUrl,
            title: this.title,
        }
    }
}

export class FireMCQQuestion extends MCQQuestion {
    constructor(id, title, answer, imageUrl) {
        super(title, answer, imageUrl);
        this.id = id;
    }

    static createFromFire(questionId, questionContent) {
        if(!questionId || !questionContent.title || !questionContent.answer || !questionContent.imageUrl) throw `Invalid fields to create Question from: ${questionId}; questionContent`;
        return new FireMCQQuestion(questionId, questionContent.title, questionContent.answer, questionContent.imageUrl);
    }

    toFireFormat() {
        // id is not needed since we use Firebase 'push' which will generate one
        return {
            id: this.id,
            answer: this.answer,
            imageUrl: this.imageUrl,
            title: this.title,
        }
    }
}

export const MCQ_ANSWER = {
    A: 'a',
    B: 'b',
    C: 'c',
    D: 'd',
}