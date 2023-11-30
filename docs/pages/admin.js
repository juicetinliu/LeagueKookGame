import { Page } from "../page.js";
import { Element, documentCreateElement } from "../components.js";
import { GAME_ROLES, LeagueKookGame, TEAM } from "../game.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";

export class AdminGamePage extends Page {
    constructor(app) {
        super("admin-game-page", app);

        this.gameEndButton = new Element("id", "admin-game-end-button");
        
        this.reset();
    }

    reset() {
        this.roomId = null;
        this.lobbyUserList = [];
        this.game = null;
        this.gameCommsBeingProcessedMap = {};
        this.isUserInitializedMap = {};
        if(this.adminCommsListener) {
            this.adminCommsListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous admin GameComms listener");
        }
        this.adminCommsListener = null;
        super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up Admin game page");
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);

        this.game = new LeagueKookGame(this.app);
        await this.game.initialize(setupArgs);

        let mcqPlayers = this.game.getMCQPlayerList();

        // Send initialization comms to all mcq users
        mcqPlayers.forEach(mcq => {
            let mcqUserId = mcq.fireUser.uid;
            let assignedQuestion = mcq.getAssignedQuestion();
            let assignedTeam = mcq.getAssignedTeam();

            let teamCodes = {}
            teamCodes[TEAM.BLUE] = "1234";
            teamCodes[TEAM.RED] = "4321";

            this.isUserInitializedMap[mcqUserId] = false;

            let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.INITIALIZE_MCQ_QUESTION_AND_CODES, {question: assignedQuestion.toFireFormat(), team: assignedTeam, teamCodes: teamCodes});
            this.app.fire.sendGameCommToParticipant(this.roomId, mcqUserId, comm);
        });

        this.adminCommsListener = this.app.fire.attachAdminGameCommsListener(this.roomId, (comms) => {
            Object.entries(comms).filter(commInfo => {
                return commInfo[1].commState === GAME_COMM_STATE.WAITING && !this.gameCommsBeingProcessedMap[commInfo[0]];
            }).forEach(commInfo => {
                this.proccessGameComms(commInfo[0], commInfo[1]);
            });
        });

        this.gameEndButton.addEventListener(["click"], () => {
            this.endGame();
        });

        super.setup();
    }

    async proccessGameComms(gameCommId, gameComm) {
        this.gameCommsBeingProcessedMap[gameCommId] = gameComm;
        if(gameComm.commType === GAME_COMM_TYPES.INITIALIZATION_DONE) {
            let fireUserUid = gameComm.data.fireUserUid;
            this.isUserInitializedMap[fireUserUid] = true;
            if(Object.values(this.isUserInitializedMap).every(i => i)) {
                // Start game once all users are intialized
                // TODO: WAIT FOR BARON TO BE INITIALIZED TOO
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

            if(baronPlayer) {
                let isValid = false;
                let damageAmount = 0;
                let team = null;
                let isLastHit = false;

                if(baronCodePackage || baronCodePackage.team) {
                    isValid = true;
                    team = baronCodePackage.team;
                    damageAmount = this.game.generateBaronDamageAmount();
                    isLastHit = this.game.damageBaronAndVerifyDeath(damageAmount);
                }

                let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.REPORT_BARON_CODE, {isValid: isValid, damageAmount: 0, team: team, isLastHit: isLastHit});
                this.app.fire.sendGameCommToParticipant(this.roomId, baronPlayer.fireUser.uid, comm);
                
                if(isLastHit) {
                    this.broadcastEndgameToMCQs(team);
                }
            }
        } else {
            console.log(`No Admin action done for comm type ${this.commType}`);
            return;
        }
        this.app.fire.setAdminGameCommAsProcessed(this.roomId, gameCommId);
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

    endGame() {
        this.app.fire.endGame(this.roomId);
        //Clear game comms
        //Go back to lobby
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
        this.lobbyUserList = setupArgs.lobbyUserList;

        this.pageState.roomId = this.roomId;
        this.pageState.lobbyUserList = this.lobbyUserList;
    }

    create() {        
        let page = documentCreateElement("div", this.label, "page");
        
        page.innerHTML = `
            <div id="admin-game-page-content" class="v vh-c hv-c">
                <div class="h hv-c vh-c panel">
                    <button id="${this.gameEndButton.label}">
                        End!
                    </button>
                </div>
            </div>
        `;
        
        super.create();
        return page;
    }

    hide() {
        super.hide();
    }

    show() {
        super.show();
    }
}