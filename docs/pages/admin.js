import { Page } from "../page.js";
import { documentCreateElement } from "../components.js";
import { GAME_ROLES, GameConstants, LeagueKookGame, TEAM } from "../game.js";
import { GAME_COMM_STATE, GAME_COMM_TYPES, GameComm } from "../fire.js";

export class AdminGamePage extends Page {
    constructor(app) {
        super("admin-game-page", app);
        
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
            // TODO: PROPER TEAM CODE MANAGEMENT/FETCHING/SETTINGS
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

        super.setup();
    }

    async proccessGameComms(gameCommId, gameComm) {
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

            let mcqPlayer = this.fetchMCQPlayerForFireUser(fireUserUid);
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
                    this.registerBaronCodeWithBaron(baronCode, mcqPlayer);
                }
            }
        } else {
            console.log(`No Admin action done for comm type ${this.commType}`);
            return;
        }
        this.app.fire.setAdminGameCommAsProcessed(this.roomId, gameCommId);
    }

    async registerBaronCodeWithBaron(baronCode, mcqPlayer) {
        let team = mcqPlayer.getAssignedTeam();
        let expiryTime = Date.now() + GameConstants.baronCodeActiveDuration;

        let baronCodePackage = {
            baronCode: baronCode, 
            team: team,
            expiryTime: expiryTime,
        }
        
        this.game.addToBaronCodeHistory(baronCodePackage);

        let comm = new GameComm(GAME_ROLES.ADMIN, GAME_COMM_TYPES.REGISTER_NEW_BARON_CODE, baronCodePackage);
        await this.app.fire.sendGameCommToParticipant(this.roomId, this.game.getBaronPlayer().fireUser.uid, comm);
    }

    fetchMCQPlayerForFireUser(fireUserUid) {
        let assignedMCQPlayerList = this.game.getMCQPlayerList().filter(mcq => {
            return mcq.fireUser.uid === fireUserUid;
        });
        if(assignedMCQPlayerList.length !== 1) throw `Not a valid mcq player to mark as correct.`
        return assignedMCQPlayerList[0];
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
            <div id="admin-game-page-wrapper">
                ADMIN
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