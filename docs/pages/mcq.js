import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";
import { GameUtils } from "../game.js";
import { FireMCQQuestion, MCQ_ANSWER } from "../question.js";

// I've decided to make the team code/answer validation on client side (this simplifies a LOT of comms). Of course this is less secure, but hey this is a game meant to be played with people in the same room, so no one should be trying to cheat anyways :)
export class MCQGamePage extends Page {
    constructor(app) {
        super("mcq-game-page", app);
        this.pageWrapper = new Element("id", "mcq-game-page-wrapper");
        this.loadingContent = new Element("id", "mcq-game-page-loading-content");
        this.questionContent = new Element("id", "mcq-game-page-question-content");
        this.answerOptions = new Element("class", "mcq-answer-option");


        this.reset();
    }

    reset() {
        this.gameCommsBeingProcessedMap = {};
        this.roomId = null;
        this.assignedQuestion = null;
        this.assignedTeam = null;
        this.teamCodes = null;
        this.previousGameState = null;
        if(this.participantCommsListener) {
            this.participantCommsListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous participant GameComms listener");
        }
        if(this.gameStateListener) {
            this.gameStateListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous GameState listener");
        }
        this.participantCommsListener = null;
        this.gameStateListener = null;
        super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up MCQ game page");
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        this.participantCommsListener = this.app.fire.attachParticipantGameCommsListener(this.roomId, (comms) => {
            Object.entries(comms).filter(commInfo => {
                return commInfo[1].commState === GAME_COMM_STATE.WAITING && !this.gameCommsBeingProcessedMap[commInfo[0]];
            }).forEach(commInfo => {
                this.proccessGameComms(commInfo[0], commInfo[1]);
            });
        });

        this.gameStateListener = this.app.fire.attachGameStateListener(this.roomId, (gameState) => {
            this.previousGameState = gameState;
            if(GameUtils.isGameInProgress(gameState) && this.assignedQuestion !== null && this.assignedTeam !== null) {
                this.showQuestionContent();
            }
        });
        
        this.showLoaderContent();
        super.setup();
    }

    async proccessGameComms(gameCommId, gameComm) {
        this.gameCommsBeingProcessedMap[gameCommId] = gameComm;
        if(gameComm.commType === GAME_COMM_TYPES.INITIALIZE_MCQ_QUESTION_AND_CODES) {
            let commQuestion = gameComm.data.question;
            let assignedTeam = gameComm.data.team;
            let teamCodes = gameComm.data.teamCodes;
            let assignedQuestion = FireMCQQuestion.createFromFire(commQuestion.id, commQuestion);
            this.setTeamCodes(teamCodes);
            this.setAssignedQuestionAndTeam(assignedQuestion, assignedTeam, true);

            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.INITIALIZATION_DONE, this.app.fire.fireUser.uid);
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
        } else if(gameComm.commType === GAME_COMM_TYPES.REPORT_MCQ_ANSWER_VERIFICATION) {
            console.log(gameComm.data);
        } else {
            console.log(`No MCQ action done for comm type ${this.commType}`);
            return;
        }
        this.app.fire.setParticipantGameCommAsProcessed(this.roomId, gameCommId);
    }

    setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;

        this.pageState.roomId = this.roomId;
    }

    setTeamCodes(teamCodes) {
        this.teamCodes = teamCodes;
    }

    setAssignedQuestionAndTeam(assignedQuestion, assignedTeam, isInitialization = false) {
        this.showLoaderContent();

        console.log(`Setting question ${assignedQuestion.id} for team ${assignedTeam}`)
        this.assignedQuestion = assignedQuestion;
        this.assignedTeam = assignedTeam;
        
        this.questionContent.getElement().innerHTML = this.createQuestionContent();

        this.answerOptions.addEventListener(["click"], async (e) => {
            this.showLoaderContent();
            let option = e.currentTarget;
            let answer = option.dataset.answer;
            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.VERIFY_MCQ_ANSWER, {fireUserUid: this.app.fire.fireUser.uid, answer: answer});
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
        });

        if(!isInitialization || GameUtils.isGameInProgress(this.previousGameState)) this.showQuestionContent();
    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="${this.pageWrapper.label}" class="h hv-c vh-c">
                <div id="${this.questionContent.label}" class="v vh-c hv-c hide">
                </div>
                ${this.createLoadingContent()}
            </div>
        `;
        
        super.create();
        return page;
    }

    createQuestionContent() {
        return `
            <div class="h hv-c vh-c">
                ${this.assignedQuestion.title}
            </div>
            <div class="h hv-c vh-c">
                ${this.assignedQuestion.imageUrl}
            </div>
            <div class="h hv-c vh-c">
                ${this.createAnswerOptions()}
            </div>
            <div class="h hv-c vh-c">
                Answer is (${this.assignedQuestion.answer}); Team is (${this.assignedTeam}; TeamCodes are (${Object.entries(this.teamCodes)}))
            </div>
        `;
    }

    createAnswerOptions() {
        return Object.entries(MCQ_ANSWER).map(answer => {
            return `
                <button id="mcq-answer-option-${answer[1]}" class="${this.answerOptions.label}" data-answer="${answer[1]}">
                    ${answer[0]}
                </button>
            `
        }).join("");
    }

    showQuestionContent() {
        this.questionContent.show();
        this.loadingContent.hide();
    }

    showLoaderContent() {
        this.questionContent.hide();
        this.loadingContent.show();
    }

    createLoadingContent() {
        return `
            <div id="${this.loadingContent.label}" class="v vh-c hv-c">
                <img id="mcq-game-page-room-loader" src="assets/ornn/ornn.gif"></img>
            </div>
        `;
    }

    show() {
        super.show();
    }
}