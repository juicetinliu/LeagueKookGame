import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";
import { GameUtils } from "../game.js";
import { FireMCQQuestion, MCQ_ANSWER } from "../question.js";
import { ONE_SECOND } from "../util.js";

/** 
 * I've decided to make the team code validation (before allowing mcq answering) on client side (this simplifies a LOT of comms and improves latency!). Of course this is less secure, but hey this is a game meant to be played with people in the same room, so no one should be trying to cheat anyways :)
 * Deets:
 *  - Ideal flow:
 *      - ADMIN -> MCQ: Send assigned MCQ team
 *      -          MCQ: Build teamCode page and team code input
 *      - MCQ -> ADMIN: Send team code for verification
 *      -        ADMIN: Verify team code
 *      - ADMIN -> MCQ: (Assume code correct) Send assigned MCQ question
 *      -          MCQ: Build question page
 *      - MCQ -> ADMIN: Send MCQ answer for verification
 *      -        ADMIN: Verify answer
 *      - ADMIN -> MCQ: (Assume answer correct) Send baron attack code
 *      -          MCQ: Display baron attack code and wait for dismissal
 *      - MCQ -> ADMIN: Request new Question/Team
 *  - Notice this ideal flow has 6 network calls. 
 *      - Pros: secure – MCQ doesn't get any secure info
 *      - Cons: latency – especially on the team code verification (team code doesn't change throughout the game; so it's a little redundant to verify each time on the ADMIN side)
 * 
 * - Implemented (simplified flow):
 *      - ADMIN -> MCQ: Send assigned MCQ team, question, and team codes
 *      -          MCQ: Build teamCode page and team code input
 *      -          MCQ: Verify team code
 *      -          MCQ: Build question page
 *      - MCQ -> ADMIN: Send MCQ answer for verification
 *      -        ADMIN: Verify answer
 *      - ADMIN -> MCQ: (Assume answer correct) Send baron attack code
 *      -          MCQ: Display baron attack code and wait for dismissal
 *      - MCQ -> ADMIN: Request new Question/Team
 *  - This simplifies things quite a bit!!!
 *      - Theoretically we COULD even have the MCQ handle the answer verification/baron code generation, but this actually makes things more complicated since the generated baron code would need to still be sent to the ADMIN computers for storage/verification. Having the ADMIN generate the baron code allows for a single point of storage (and for BARON computer to later verify with the ADMIN)
 */
export class MCQGamePage extends Page {
    constructor(app) {
        super("mcq-game-page", app);
        this.pageWrapper = new Element("id", "mcq-game-page-wrapper");
        this.loadingContent = new Element("id", "mcq-game-page-loading-content");
        this.questionContent = new Element("id", "mcq-game-page-question-content");

        this.teamCodeInput = new Element("id", "mcq-team-code-input");
        this.teamCodeSubmitButton = new Element("id", "mcq-team-code-submit-button");

        this.answerOptions = new Element("class", "mcq-answer-option");

        this.moveToNextQuestionButton = new Element("id", "mcq-move-to-next-question");
        this.lockoutTimerText = new Element("id", "mcq-lockout-timer-text");
        this.answerWindowTimerText = new Element("id", "mcq-answer-window-timer-text");
        this.returnToLobbyButton = new Element("id", "mcq-return-to-lobby");

        this.reset();
    }

    reset(resetPageState = true) {
        this.gameCommsBeingProcessedMap = {};

        this.assignedQuestion = null;
        this.assignedTeam = null;
        this.teamCodes = null;
        this.previousGameState = null;

        //Initialize durations through ADMIN call?
        this.questionAnswerWindowDuration = null;
        this.questionWrongLockoutDuration = null;

        this.questionAnswerTimerCounter = 0;
        this.resetQuestionAnswerTimer();

        this.questionLockoutTimerCounter = 0;
        this.resetQuestionLockoutTimer();

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
        if(resetPageState) super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up MCQ game page");
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        if(!this.roomId || this.winningTeam || this.gameEnded) {
            console.log(`roomId: ${this.roomId}, winningTeam: ${this.winningTeam}, gameEnded: ${this.gameEnded}`);
            this.showEndGameView();
        } else {
            // TODO: Refactor into fire?
            this.participantCommsListener = this.app.fire.attachParticipantGameCommsListener(this.roomId, (comms) => {
                Object.entries(comms).filter(commInfo => {
                    return commInfo[1].commState === GAME_COMM_STATE.WAITING && !this.gameCommsBeingProcessedMap[commInfo[0]];
                }).forEach(commInfo => {
                    this.processGameComms(commInfo[0], commInfo[1]);
                });
            });

            this.gameStateListener = this.app.fire.attachGameStateListener(this.roomId, (gameState) => {
                this.previousGameState = gameState;
                if(GameUtils.isGameInProgress(gameState) && this.assignedQuestion !== null && this.assignedTeam !== null) {
                    this.showQuestionContent();
                } else if (GameUtils.hasGameEnded(gameState)) {
                    if(GameUtils.isGameInLobby(gameState)) {
                        console.log("=== GAME CLOSED ===");
                        this.reset(false);
                        this.gameEnded = true;
                        this.pageState.gameEnded = this.gameEnded;
                        this.app.savePageStateToHistory(true);
                        this.showEndGameView();
                    }
                }
            });
            this.showLoaderContent();
        }
        super.setup();
    }

    async processGameComms(gameCommId, gameComm) {
        this.gameCommsBeingProcessedMap[gameCommId] = gameComm;
        if(gameComm.commType === GAME_COMM_TYPES.INITIALIZE_MCQ_QUESTION_AND_CODES) {
            let commQuestion = gameComm.data.question;
            let assignedTeam = gameComm.data.team;
            let teamCodes = gameComm.data.teamCodes;
            let assignedQuestion = FireMCQQuestion.createFromFire(commQuestion.id, commQuestion);
            this.setTeamCodes(teamCodes);
            this.setQuestionDurations(gameComm.data.answerDuration, gameComm.data.lockoutDuration)
            this.setAssignedQuestionAndTeam(assignedQuestion, assignedTeam);

            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.INITIALIZATION_DONE, {fireUserUid: this.app.fire.fireUser.uid});
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);

            this.showTeamCodeInputView(true);
        } else if(gameComm.commType === GAME_COMM_TYPES.REPORT_MCQ_ANSWER_VERIFICATION) {
            this.showQuestionAnsweredView(gameComm.data.isCorrect, gameComm.data.baronCode);
        } else if(gameComm.commType === GAME_COMM_TYPES.ASSIGN_MCQ_QUESTION) {
            let commQuestion = gameComm.data.question;
            let assignedTeam = gameComm.data.team;
            let assignedQuestion = FireMCQQuestion.createFromFire(commQuestion.id, commQuestion);
            this.setAssignedQuestionAndTeam(assignedQuestion, assignedTeam);

            this.showTeamCodeInputView();
        } else if(gameComm.commType === GAME_COMM_TYPES.NOTIFY_MCQ_END_GAME) {
            console.log("=== GAME ENDED ===");
            this.winningTeam = gameComm.data.winningTeam;
            this.pageState.winningTeam = this.winningTeam;
            this.app.savePageStateToHistory(true);

            this.showEndGameView();
        } else {
            console.log(`No MCQ action done for comm type ${this.commType}`);
            return;
        }
        this.app.fire.setParticipantGameCommAsProcessed(this.roomId, gameCommId);
    }

    setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;
        this.roomPasscode = setupArgs.roomPasscode;
        this.winningTeam = setupArgs.winningTeam;
        this.gameEnded = setupArgs.gameEnded;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.winningTeam = this.winningTeam;
        this.pageState.gameEnded = this.gameEnded;
    }

    setTeamCodes(teamCodes) {
        this.teamCodes = teamCodes;
    }

    setQuestionDurations(answerDuration, lockoutDuration) {
        this.questionAnswerWindowDuration = answerDuration;
        this.questionWrongLockoutDuration = lockoutDuration;

        this.questionAnswerTimerCounter = 0;
        this.resetQuestionAnswerTimer();

        this.questionLockoutTimerCounter = 0;
        this.resetQuestionLockoutTimer();
    }

    setAssignedQuestionAndTeam(assignedQuestion, assignedTeam) {
        console.log(`Setting question ${assignedQuestion.id} for team ${assignedTeam}`)
        this.assignedQuestion = assignedQuestion;
        this.assignedTeam = assignedTeam;
    }

    showQuestionView(shouldStartQuestionAnswerTimer = false) {
        this.showLoaderContent();

        if(shouldStartQuestionAnswerTimer) {
            this.questionAnswerTimerCounter = this.questionAnswerWindowDuration;
        }
        
        this.questionContent.getElement().innerHTML = this.createQuestionContent();

        this.answerOptions.addEventListener(["click"], async (e) => {
            this.showLoaderContent();
            let option = e.currentTarget;
            let answer = option.dataset.answer;
            let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.VERIFY_MCQ_ANSWER, {fireUserUid: this.app.fire.fireUser.uid, answer: answer});
            await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
            return;
        });

        this.showQuestionContent(shouldStartQuestionAnswerTimer);
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

    showEndGameView() {
        this.showLoaderContent(true);
        this.questionContent.getElement().innerHTML = this.createEndGameContent();

        this.returnToLobbyButton.addEventListener(["click"], async () => {
            this.showLoaderContent();

            await this.app.goToPage(this.app.pages.lobby, {
                roomId: this.roomId,
                roomPasscode: this.roomPasscode,
                isAdmin: false,
                isParticipant: true,
                isRoomLocked: false,
                isReady: true,
            });
            return;
        });

        this.showQuestionContent();
    }

    showQuestionAnsweredView(isCorrect, baronCode) {
        this.showLoaderContent();
        this.questionContent.getElement().innerHTML = this.createQuestionAnsweredContent(isCorrect, baronCode);
        if(!isCorrect) {
            this.startQuestionLockoutTimer();
        } else {
            this.resetQuestionAnswerTimer();

            this.moveToNextQuestionButton.addEventListener(["click"], async () => {
                this.showLoaderContent(true);

                let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.REQUEST_MCQ_QUESTION, {fireUserUid: this.app.fire.fireUser.uid});
                await this.app.fire.sendGameCommToAdmin(this.roomId, comm);
                return;
            });
        }
        this.showQuestionContent();
    }

    resetQuestionAnswerTimer() {
        if(this.questionAnswerTimerInterval) {
            clearInterval(this.questionAnswerTimerInterval);
        } 
        this.questionAnswerTimerInterval = null;
        this.questionAnswerTimerCounter = this.questionAnswerWindowDuration;
    }

    resetQuestionLockoutTimer() {
        if(this.questionLockoutTimerInterval) {
            clearInterval(this.questionLockoutTimerInterval);
        } 
        this.questionLockoutTimerInterval = null;
        this.questionLockoutTimerCounter = this.questionWrongLockoutDuration;
    }

    startQuestionAnswerTimer() {
        this.questionAnswerTimerInterval = setInterval(() => {
            this.questionAnswerTimerCounter -= ONE_SECOND;
            if(this.answerWindowTimerText.exists()) {
                this.answerWindowTimerText.getElement().innerHTML = this.questionAnswerTimerCounter / ONE_SECOND;
            }

            if(this.questionAnswerTimerCounter <= 0) {
                this.resetQuestionAnswerTimer();
                this.resetQuestionLockoutTimer();
                
                this.showLoaderContent(true);

                let comm = new GameComm(this.app.fire.fireUser.uid, GAME_COMM_TYPES.REQUEST_MCQ_QUESTION, {fireUserUid: this.app.fire.fireUser.uid});
                this.app.fire.sendGameCommToAdmin(this.roomId, comm);
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
                this.resetQuestionLockoutTimer();

                this.showQuestionView(false);
                return;
            }
        }, ONE_SECOND);
    }

    showTeamCodeInputView(isBufferedView = false) {
        if(this.teamCodeInputErrorTimeout) {
            clearTimeout(this.teamCodeInputErrorTimeout);
        }
        this.showLoaderContent(true);
        this.questionContent.getElement().innerHTML = this.createTeamCodeInputContent();
        
        this.teamCodeInput.addEventListener(["input"], () => {
            this.teamCodeInput.getElement().classList.remove("wrong");
            if(this.teamCodeInputErrorTimeout) {
                clearTimeout(this.teamCodeInputErrorTimeout);
            }
            return;
        });
        this.teamCodeSubmitButton.addEventListener(["click"], () => {
            let teamCodeInputValue = this.teamCodeInput.getElement().value;

            if(teamCodeInputValue === this.teamCodes[this.assignedTeam]) {
                console.log("Team code was correct, showing question");
                this.showQuestionView(true);
            } else {
                if(this.teamCodeInputErrorTimeout) {
                    clearTimeout(this.teamCodeInputErrorTimeout);
                }
                this.teamCodeInput.getElement().classList.add("wrong");
                this.teamCodeInputErrorTimeout = setTimeout(() => {
                    this.teamCodeInput.getElement().classList.remove("wrong");
                }, 500);
                console.log("Team code incorrect, try again");
            }
            return;
        });

        // !isBufferedView - we don't want to show the content if we buffer it; THOUGH we must make sure to call showQuestionContent again.
        // isGameInProgress - we show the content straight away since the game has already started!!
        if(!isBufferedView || GameUtils.isGameInProgress(this.previousGameState)) this.showQuestionContent();
    }

    createEndGameContent() {
        if(this.winningTeam) {
            return `
                <div class="h hv-c vh-c">
                    Congrats team ${this.winningTeam} on defeating Baron!
                </div>
                <div class="h hv-c vh-c">
                    <button id=${this.returnToLobbyButton.label}>
                        Return to Lobby
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="h hv-c vh-c">
                    Game is closed, return to lobby!
                </div>
                <div class="h hv-c vh-c">
                    <button id=${this.returnToLobbyButton.label}>
                        Return to Lobby
                    </button>
                </div>
            `;
        }
    }

    createTeamCodeInputContent() {
        return `
            <div class="h hv-c vh-c">
                This question is for team ${this.assignedTeam}.
            </div>
            <div class="h hv-c vh-c">
                What is your team code? Hint: teamCodes are (${Object.entries(this.teamCodes)})
            </div>
            <div class="h hv-c vh-c">
                <div id="team-code-input-panel" class="panel h hv-c vh-c">
                    <input id="${this.teamCodeInput.label}" placeholder="Enter Team Code">
                    <button id="${this.teamCodeSubmitButton.label}">
                        Submit
                    </button>
                </div>
            </div>
        `;
    }

    createQuestionAnsweredContent(isCorrect, baronCode) {
        if(isCorrect) {
            return `
                <div class="h hv-c vh-c">
                    Congrats that's the correct answer!
                </div>
                <div class="h hv-c vh-c">
                    Here's the Baron Attack Code: ${baronCode}
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
                        ${this.questionWrongLockoutDuration / ONE_SECOND}
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
                    ${this.questionAnswerWindowDuration / ONE_SECOND}
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

    showQuestionContent(shouldStartQuestionAnswerTimer = false) {
        if(shouldStartQuestionAnswerTimer) {
            this.startQuestionAnswerTimer();
        }
        this.questionContent.show();
        this.loadingContent.hide();
    }

    showLoaderContent(clearQuestionContent = false) {
        if(clearQuestionContent) {
            this.questionContent.getElement().innerHTML = "";
        }
        this.questionContent.hide();
        this.loadingContent.show();
    }

    createLoadingContent() {
        return `
            <div id="${this.loadingContent.label}" class="v vh-c hv-c">
                <img id="mcq-game-page-loader" src="assets/ornn/ornn.gif"></img>
            </div>
        `;
    }

    show() {
        super.show();
    }
}