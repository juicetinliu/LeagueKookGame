import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GAME_ROLES, LeagueKookGame, LeagueKookGameSettings, TEAM } from "../game.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";
import { ONE_SECOND } from "../util.js";

export class AdminGamePage extends Page {
    constructor(app) {
        super("admin-game-page", app);
        this.pageWrapper = new Element("id", "admin-game-page-wrapper");

        this.gameEndButton = new Element("id", "admin-game-end-button");

        this.adminBaronViewSwitchButtonWrapper = new Element("id", "admin-baron-view-switch-button-wrapper");
        this.adminBaronViewSwitchButton = new Element("id", "admin-baron-view-switch-button");

        this.gameInfoPanel = new Element("id", "admin-game-info-panel");
        this.baronCodeHistoryPanel = new Element("id", "admin-baron-code-history-panel");
        this.teamAttackHistoryPanel = new Element("id", "admin-team-attack-history-panel");

        this.reset();
    }

    reset() {
        this.game = null;
        this.gameCommsBeingProcessedMap = {};
        this.isUserInitializedMap = {};

        if(this.adminCommsListener) {
            this.adminCommsListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous admin GameComms listener");
        }
        this.adminCommsListener = null;

        if(this.baronCodeHistoryInterval) {
            clearInterval(this.baronCodeHistoryInterval);
        }
        this.baronCodeHistoryInterval = null;

        super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up Admin game page");
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        if(this.winningTeam || this.gameEnded) {
            // POSSIBLE BUG: History is saved with winning state when game ends – but we don't use this in any way. This might cause bugs? we'll see.
            return;
        }

        if(this.isBaron) {
            this.baronPage = this.app.pages.baronGame;
            this.adminBaronViewSwitchButtonWrapper.getElement().innerHTML = this.createBaronViewSwitchButton();
            this.adminBaronViewSwitchButtonWrapper.show();

            this.adminBaronViewSwitchButton.addEventListener(["click"], () => {
                this.baronPage.show();
                this.hide();
                return;
            });
        } else {
            this.adminBaronViewSwitchButtonWrapper.hide();
        }

        let fireGameSettings = await this.app.fire.getGameSettings(this.roomId);
        let gameSettings = LeagueKookGameSettings.createFromFire(fireGameSettings);
        // TODO: Settings page for game!
        this.game = new LeagueKookGame(this.app, gameSettings);
        if(!await this.game.initialize(setupArgs)) {
            await this.closeGame();
            return;
        }

        this.setupAdminPagePanel();
        this.baronCodeHistoryInterval = setInterval(() => {
            this.updateBaronCodeHistoryPanel();
        }, ONE_SECOND);

        // Clear game comms from previous game:
        await this.app.fire.clearRoomComms(this.roomId, this.lobbyUserList);

        let mcqPlayers = this.game.getMCQPlayerList();
        let baronPlayer = this.game.getBaronPlayer();

        // First initialize player map (before starting game)
        mcqPlayers.forEach(mcq => {
            let mcqFireUserId = mcq.fireUser.uid;
            this.isUserInitializedMap[mcqFireUserId] = false;
        });
        this.isUserInitializedMap[this.getBaronFireUserUidWithBaronFallback(baronPlayer)] = false;

        // Send initialization comms to all mcq users
        mcqPlayers.forEach(mcq => {
            let mcqFireUserId = mcq.fireUser.uid;
            let assignedQuestion = mcq.getAssignedQuestion();
            let assignedTeam = mcq.getAssignedTeam();

            let teamCodes = this.game.settings.getTeamCodes();

            let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.INITIALIZE_MCQ_QUESTION_AND_CODES, {
                    question: assignedQuestion.toFireFormat(), 
                    team: assignedTeam, 
                    teamCodes: teamCodes, 
                    answerDuration: this.game.settings.questionAnswerWindowDuration, 
                    lockoutDuration: this.game.settings.questionWrongLockoutDuration,
                });
            this.app.fire.sendGameCommToParticipant(this.roomId, mcqFireUserId, comm);
        });

        let baronInitializeComm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.INITIALIZE_BARON, {health: baronPlayer.getHealth()});
        this.sendGameCommToBaronWithBaronFallback(baronPlayer, baronInitializeComm);

        // TODO: Refactor into fire?
        this.adminCommsListener = this.app.fire.attachAdminGameCommsListener(this.roomId, (comms) => {
            Object.entries(comms).filter((commInfo) => {
                return commInfo[1].commState === GAME_COMM_STATE.WAITING && !this.gameCommsBeingProcessedMap[commInfo[0]];
            }).forEach(commInfo => {
                this.processGameComms(commInfo[0], commInfo[1]);
            });
        });

        if(!this.setupCompleted){
            this.gameEndButton.addEventListener(["click"], async () => {
                await this.closeGame();
                return;
            });
        }
        super.setup();
    }

    async processGameComms(gameCommId, gameComm) {
        console.log(`Processing GameComm ${gameCommId}: ${Object.entries(gameComm.data)}`)
        this.gameCommsBeingProcessedMap[gameCommId] = gameComm;
        if(gameComm.commType === GAME_COMM_TYPES.INITIALIZATION_DONE) {
            let fireUserUid = gameComm.data.fireUserUid;
            this.isUserInitializedMap[fireUserUid] = true;
            if(Object.values(this.isUserInitializedMap).every(i => i)) {
                // Start game once all users are intialized
                this.app.fire.startGame(this.roomId);
            }
        } else if(gameComm.commType === GAME_COMM_TYPES.VERIFY_MCQ_ANSWER) {
            let fireUserUid = gameComm.data.fireUserUid;
            let answer = gameComm.data.answer;

            let mcqPlayer = this.game.fetchMCQPlayerForFireUser(fireUserUid);
            if(mcqPlayer) {
                let baronCode = null;
                let isCorrect = false;
                if(mcqPlayer.getAssignedQuestion().answer === answer) {
                    isCorrect = true;
                    baronCode = this.game.generateBaronCode();
                }

                let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.REPORT_MCQ_ANSWER_VERIFICATION, {isCorrect: isCorrect, baronCode: baronCode});
                this.app.fire.sendGameCommToParticipant(this.roomId, fireUserUid, comm);

                if(isCorrect) {
                    this.registerBaronCode(baronCode, mcqPlayer);
                    this.updateBaronCodeHistoryPanel();
                }
            }
        } else if(gameComm.commType === GAME_COMM_TYPES.REQUEST_MCQ_QUESTION) {
            let fireUserUid = gameComm.data.fireUserUid;
            let mcqPlayer = this.game.fetchMCQPlayerForFireUser(fireUserUid);
            
            if(mcqPlayer) {
                mcqPlayer.completedQuestion();
                this.game.assignTeamsToUnassignedMCQs();
                this.game.assignQuestionsToMCQs();
                let assignedQuestion = mcqPlayer.getAssignedQuestion();
                let assignedTeam = mcqPlayer.getAssignedTeam();

                console.log(`Assigning question ${assignedQuestion.id} for team ${assignedTeam}`)

                let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.ASSIGN_MCQ_QUESTION, {question: assignedQuestion, team: assignedTeam});
                this.app.fire.sendGameCommToParticipant(this.roomId, fireUserUid, comm);
            }
        } else if(gameComm.commType === GAME_COMM_TYPES.VERIFY_BARON_CODE) {
            let baronCode = gameComm.data.baronCode;
            let baronCodePackage = this.game.verifyDeactivateAndReturnBaronCodePackage(baronCode);
            let baronPlayer = this.game.getBaronPlayer();

            this.updateBaronCodeHistoryPanel();

            if(baronPlayer) {
                let isValid = false;
                let damageAmount = 0;
                let healthAfterDamage = 0;
                let team = null;
                let isLastHit = false;

                if(baronCodePackage || baronCodePackage.team) {
                    isValid = true;
                    team = baronCodePackage.team;
                    damageAmount = this.game.generateBaronDamageAmount();
                    isLastHit = this.game.damageBaronAndVerifyDeath(damageAmount);
                    healthAfterDamage = baronPlayer.getHealth();
                }

                let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.REPORT_BARON_CODE, {isValid: isValid, damageAmount: damageAmount, healthAfterDamage: healthAfterDamage, team: team, isLastHit: isLastHit});
                this.sendGameCommToBaronWithBaronFallback(baronPlayer, comm);

                if(isLastHit) {
                    this.broadcastEndgameToMCQs(team);

                    this.winningTeam = team;
                    this.gameEnded = true;
                    this.pageState.winningTeam = this.winningTeam;
                    this.pageState.gameEnded = this.gameEnded;
                    if(!this.isBaron) {
                        this.app.savePageStateToHistory(true);
                    }

                    await this.app.fire.endGame(this.roomId);
                }
            }
        } else {
            console.log(`No Admin action done for comm type ${this.commType}`);
            return;
        }
        await this.markGameCommProcessedWithAdminFallback(gameCommId);
    }

    getBaronFireUserUidWithBaronFallback(baronPlayer) {
        return this.isBaron ? GAME_ROLES.ADMIN : baronPlayer.fireUser.uid;
    }

    async sendGameCommToBaronWithBaronFallback(baronPlayer, comm) {
        if(this.isBaron) {
            await this.baronPage.processGameComms(comm.id, comm.toFireFormat());
        } else {
            await this.app.fire.sendGameCommToParticipant(this.roomId, baronPlayer.fireUser.uid, comm);
        }
    }

    async markGameCommProcessedWithAdminFallback(gameCommId) {
        if(this.isBaron && (gameCommId.split("_")[1] === GAME_ROLES.ADMIN)) {
            console.log(`No need to mark comm ${gameCommId} as processed since user is also Baron.`)
        } else {
            await this.app.fire.setAdminGameCommAsProcessed(this.roomId, gameCommId);
        }
    }

    async registerBaronCode(baronCode, mcqPlayer) {
        let team = mcqPlayer.getAssignedTeam();
        let expiryTime = Date.now() + this.game.getBaronCodeActiveDuration();

        let baronCodePackage = {
            baronCode: baronCode, 
            team: team,
            expiryTime: expiryTime,
            active: true,
        }
        
        this.game.addToBaronCodeHistory(baronCodePackage);
    }

    async closeGame() {
        this.gameEnded = true;
        this.pageState.gameEnded = this.gameEnded;
        if(!this.isBaron) {
            this.app.savePageStateToHistory(true);
        }
        await this.app.fire.leaveGame(this.roomId);

        await this.app.goToPage(this.app.pages.lobby, {
            roomId: this.roomId,
            roomPasscode: this.roomPasscode,
            isAdmin: true,
            isParticipant: true,
            isRoomLocked: false,
            isReady: true,
        });
        return;
    }

    broadcastEndgameToMCQs(winningTeam) {
        let mcqPlayers = this.game.getMCQPlayerList();
        mcqPlayers.forEach(mcq => {
            let mcqUserId = mcq.fireUser.uid;

            let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.NOTIFY_MCQ_END_GAME, {winningTeam: winningTeam});
            this.app.fire.sendGameCommToParticipant(this.roomId, mcqUserId, comm);
        });
    } 

    setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;
        this.roomPasscode = setupArgs.roomPasscode;
        this.isBaron = setupArgs.isBaron;
        this.lobbyUserList = setupArgs.lobbyUserList;
        this.winningTeam = setupArgs.winningTeam;
        this.gameEnded = setupArgs.gameEnded;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.isBaron = this.isBaron;
        this.pageState.lobbyUserList = this.lobbyUserList;
        this.pageState.winningTeam = this.winningTeam;
        this.pageState.gameEnded = this.gameEnded;
    }

    createBaronViewSwitchButton() {
        return `
            <button id="${this.adminBaronViewSwitchButton.label}">
                Switch to Baron view
            </button>
        `;
    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="${this.pageWrapper.label}" class="v vh-c hv-c">
                <div id="${this.adminBaronViewSwitchButtonWrapper.label}" class="h hv-c vh-c">
                </div>
                <div id="admin-game-panel" class="h hv-c vh-c panel">
                    <div id="admin-game-info-panel" class="v hv-c vh-t panel">
                        <div id="${this.gameInfoPanel.label}" class="v hv-c vh-c"> Game Info </div>
                    </div>
                    <div class="admin-game-stats-panel v hv-c vh-t panel">
                        <div class="admin-panel-info-header"> Baron Attack Codes: </div>
                        <div id="${this.baronCodeHistoryPanel.label}" class="v hv-l vh-t"> - </div>
                    </div>
                    <div class="admin-game-stats-panel v hv-c vh-t panel">
                        <div class="admin-panel-info-header"> Attack History: </div>
                        <div id="${this.teamAttackHistoryPanel.label}" class="v hv-l vh-t"> - </div>
                    </div>
                </div>
                <div class="h hv-c vh-c">
                    <button id="${this.gameEndButton.label}">
                        End Game!
                    </button>
                </div>
            </div>
        `;
        
        super.create();
        return page;
    }

    setupAdminPagePanel() {
        this.gameInfoPanel.getElement().innerHTML = `
            <div class="admin-panel-info-header"> Team Codes: </div>
            <div> Blue: ${this.game.settings.teamCodes[TEAM.BLUE]} </div>
            <div> Red: ${this.game.settings.teamCodes[TEAM.RED]} </div>
        `;
    }

    updateBaronCodeHistoryPanel() {
        let baronCodeHistory = this.game.getBaronCodeHistory();
        let baronCodeHistoryHTML = baronCodeHistory.length ? "" : "-";
        baronCodeHistory.forEach(baronCodePackage => {
            let baronCode = baronCodePackage.baronCode;
            let expiryTime = baronCodePackage.expiryTime;
            let baronCodeActive = baronCodePackage.active;
            let isCodeExpired = Date.now() >= expiryTime;
            let isCodeActive = baronCodeActive && !isCodeExpired;
            let timeLeft = Math.round((expiryTime - Date.now()) / ONE_SECOND) + "s";
            let entryId = `baron-code-entry-${baronCode}`;

            baronCodeHistoryHTML += `
                <div id="${entryId}" class="baron-code-history-panel-entry h hv-l vh-c ${isCodeActive ? "" : "inactive-entry"}">
                    <div class="baron-code-history-panel-entry-baron-code">${baronCode}</div>
                    <div class="text-vert-divider"> | </div>
                    <div class="baron-code-history-panel-entry-team team-${baronCodePackage.team}">${baronCodePackage.team}</div>
                    <div class="text-vert-divider"> | </div>
                    <div class="baron-code-history-panel-entry-active">${baronCodeActive ? (isCodeExpired ? "Expired" : timeLeft) :  "Used"}</div>
                </div>
            `
        });
        this.baronCodeHistoryPanel.getElement().innerHTML = baronCodeHistoryHTML;
    }

    updateTeamAttackHistoryPanel() {
    }

    hide() {
        super.hide();
    }

    show() {
        super.show(!this.isBaron);
    }
}