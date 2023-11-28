import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";
import { GameConstants, GameUtils } from "../game.js";
import { FireMCQQuestion, MCQ_ANSWER } from "../question.js";
import { ONE_SECOND } from "../util.js";

// I've decided to make the team code/answer validation on client side (this simplifies a LOT of comms). Of course this is less secure, but hey this is a game meant to be played with people in the same room, so no one should be trying to cheat anyways :)
export class MCQGamePage extends Page {
    constructor(app) {
        super("mcq-game-page", app);
        this.pageWrapper = new Element("id", "mcq-game-page-wrapper");
        this.loadingContent = new Element("id", "mcq-game-page-loading-content");
        this.questionContent = new Element("id", "mcq-game-page-question-content");
        this.answerOptions = new Element("class", "mcq-answer-option");

        this.moveToNextQuestionButton = new Element("id", "mcq-move-to-next-question");
        this.lockoutTimerText = new Element("id", "mcq-lockout-timer-text");
        this.answerWindowTimerText = new Element("id", "mcq-answer-window-timer-text");

        this.reset();
    }

    reset() {
        this.gameCommsBeingProcessedMap = {};
        this.roomId = null;
        this.assignedQuestion = null;
        this.assignedTeam = null;
        this.teamCodes = null;
        this.previousGameState = null;

        this.questionAnswerTimerCounter = GameConstants.questionAnswerWindowDuration;
        if(this.questionAnswerTimerInterval) {
            clearInterval(this.questionAnswerTimerInterval);
        } 
        this.questionAnswerTimerInterval = null;
        this.questionLockoutTimerCounter = GameConstants.questionWrongLockoutDuration;
        if(this.questionLockoutTimerInterval) {
            clearInterval(this.questionLockoutTimerInterval);
        } 
        this.questionLockoutTimerInterval = null;

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
                this.showQuestionContent(true);
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
            this.proceedToQuestionAnsweredView(gameComm.data.isCorrect, gameComm.data.baronCode);
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

    setAssignedQuestionAndTeam(assignedQuestion = null, assignedTeam = null, isInitialization = false) {
        this.showLoaderContent();

        let isNewQuestion = true;
        if(!assignedQuestion && !assignedTeam) {
            isNewQuestion = false;
            console.log("Showing previous question again");
        } else { 
            console.log(`Setting question ${assignedQuestion.id} for team ${assignedTeam}`)
            this.assignedQuestion = assignedQuestion;
            this.assignedTeam = assignedTeam;

            this.questionAnswerTimerCounter = GameConstants.questionAnswerWindowDuration;
        }
        
        this.questionContent.getElement().innerHTML = this.createQuestionContent();

        this.answerOptions.addEventListener(["click"], async (e) => {
            this.showLoaderContent();
            let option = e.currentTarget;
            let answer = option.dataset.answer;
            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.VERIFY_MCQ_ANSWER, {fireUserUid: this.app.fire.fireUser.uid, answer: answer});
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
        });

        if(!isInitialization || GameUtils.isGameInProgress(this.previousGameState)) this.showQuestionContent(isNewQuestion);
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

    proceedToQuestionAnsweredView(isCorrect, baronCode) {
        this.showLoaderContent();
        this.questionContent.getElement().innerHTML = this.createQuestionAnsweredContent(isCorrect, baronCode);
        if(!isCorrect) {
            this.startQuestionLockoutTimer();
        } else {
            clearInterval(this.questionAnswerTimerInterval);
            this.questionAnswerTimerInterval = null;
            
            this.questionAnswerTimerCounter = GameConstants.questionAnswerWindowDuration;

            //setup button listener for close
        }
        this.showQuestionContent(false);
    }

    startQuestionAnswerTimer() {
        this.questionAnswerTimerInterval = setInterval(() => {
            this.questionAnswerTimerCounter -= ONE_SECOND;
            if(this.answerWindowTimerText.exists()) {
                this.answerWindowTimerText.getElement().innerHTML = this.questionAnswerTimerCounter / ONE_SECOND;
            }

            if(this.questionAnswerTimerCounter <= 0) {
                clearInterval(this.questionAnswerTimerInterval);
                this.questionAnswerTimerInterval = null;
                
                this.questionAnswerTimerCounter = GameConstants.questionAnswerWindowDuration;
                //request new question!!
                return;
            }
        }, ONE_SECOND);
    }

    startQuestionLockoutTimer() {
        this.questionLockoutTimerInterval = setInterval(() => {
            this.questionLockoutTimerCounter -= ONE_SECOND;
            if(this.lockoutTimerText.exists()) {
                this.lockoutTimerText.getElement().innerHTML = this.questionLockoutTimerCounter / ONE_SECOND;
            }
            
            if(this.questionLockoutTimerCounter <= 0) {
                clearInterval(this.questionLockoutTimerInterval);
                this.questionLockoutTimerInterval = null;

                this.questionLockoutTimerCounter = GameConstants.questionWrongLockoutDuration;
                this.setAssignedQuestionAndTeam();
                return;
            }
        }, ONE_SECOND);
    }



    createQuestionAnsweredContent(isCorrect, baronCode) {
        if(isCorrect) {
            return `
                <div class="h hv-c vh-c">
                    Congrats that's the correct answer!
                </div>
                <div class="h hv-c vh-c">
                    Here's the baron attack code: ${baronCode}
                </div>
                <div class="h hv-c vh-c">
                    It will expire 5 mins from NOW, so use it wisely!
                </div>
                <div class="h hv-c vh-c">
                    Close this message once you've memorized the code :D
                </div>
                <div class="h hv-c vh-c">
                    <button id=${this.moveToNextQuestionButton.label}>
                        Close
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="h hv-c vh-c">
                    Sorry that's the wrong answer.
                    </div>
                <div class="h hv-c vh-c">
                    You're timed out for 1 minute until you can try again.
                </div>
                <div class="h hv-c vh-c">
                    <div id=${this.lockoutTimerText.label}>
                        ${GameConstants.questionWrongLockoutDuration / ONE_SECOND}
                    </div>
                </div>
            `;
        }
    }

    createQuestionContent() {
        return `
            <div class="h hv-c vh-c">
                ${this.assignedQuestion.title}
            </div>
            <div id="mcq-game-page-question-image" class="h hv-c vh-c">
                <img src="${this.assignedQuestion.imageUrl}">
            </div>
            <div class="h hv-c vh-c">
                ${this.createAnswerOptions()}
            </div>
            <div class="h hv-c vh-c">
                Answer is (${this.assignedQuestion.answer}); Team is (${this.assignedTeam}; TeamCodes are (${Object.entries(this.teamCodes)}))
            </div>
            <div class="h hv-c vh-c">
                <div id=${this.answerWindowTimerText.label}>
                    ${GameConstants.questionAnswerWindowDuration / ONE_SECOND}
                </div>
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

    showQuestionContent(isNewQuestion) {
        if(isNewQuestion) {
            this.startQuestionAnswerTimer();
        }
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