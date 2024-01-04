import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getDatabase, ref, child, get, set, onValue, remove, update, push } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js"
import { GAME_ROLES, GAME_STATES, GameUtils, LeagueKookGameSettings, PROFILE_IMAGES_CODES, RoomUtils, WAIT_LIST_STATES } from "./game.js";
import { getRandomElementFromArray } from "./util.js";

export class Fire {
    constructor() {


        // Your web app's Firebase configuration
        // For Firebase JS SDK v7.20.0 and later, measurementId is optional
        this.firebaseConfig = {
            apiKey: "AIzaSyCCH6Gvq92E1EZPt74UKgFG7tFe9meJuYg",
            authDomain: "leaguekookgame.firebaseapp.com",
            databaseURL: "https://leaguekookgame-default-rtdb.firebaseio.com",
            projectId: "leaguekookgame",
            storageBucket: "leaguekookgame.appspot.com",
            messagingSenderId: "110240255051",
            appId: "1:110240255051:web:0dacffb95989997fcdd1ce",
            measurementId: "G-S85K29YZN7"
        };

        // Initialize Firebase
        this.fireapp = initializeApp(this.firebaseConfig);
        this.auth = getAuth(this.fireapp);
        this.dbRef = ref(getDatabase());


        this.fireUser = null;

        this.PATHS = {
            ROOMS: "rooms",

            ROOM_ADMIN: "admin",
            ROOM_LOCKED: "locked",
            ROOM_ACTIVE_TIME: "activeTime",
            ROOM_GAME_SETTINGS: "settings",
            ROOM_PASSCODE: "passcode",
            ROOM_BLOCK_LIST: "blockList",
            ROOM_WAIT_LIST: "waitList",
            ROOM_LOBBY_LIST: "lobbyList",
            ROOM_GAME_STATE: "gameState",

            LOBBY_USER_GAME_COMMS: "gameComms",
            GAME_COMMS_TO_USER: "toUser",
            GAME_COMMS_TO_ADMIN: "gameCommsToAdmin",

            QUESTION_BANK: "questionBank",
            QUESTION_BANK_OWNER: "owner",
            QUESTION_BANK_QUESTIONS: "questions",
            QUESTION_ANSWER: "answer",
            QUESTION_BACKGROUND_IMG: "backgroundImg",
            QUESTION_TITLE: "title",
        }

        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                // User is signed in, see docs for a list of available properties
                // https://firebase.google.com/docs/reference/js/auth.user
                console.log(user.uid);
                this.fireUser = user;
                
            } else {
                // User is signed out
                // ...
            }
        })
    }

    async createAnonymousUser() {
        await signInAnonymously(this.auth).then((response) => {
            // console.log(response);
        }).catch((error) => {
            throw error;
        });
    }

    async isAdminOfRoom(roomId) {
        console.log(`Checking if ${this.fireUser.uid} is admin of ${roomId}`);

        try {
            await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ADMIN}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Participant only operation** - Join lobby waitlist
     */
    async joinWaitList(roomId, passcode) {
        console.log(`Attempting to join WaitList for room ${roomId}`);
        if(await this.isAdminOfRoom(roomId)) return {isAdmin: true, isParticipant: true};
        
        let participantInfo = await this.getParticipantOfRoom(roomId);
        if(participantInfo) return {isAdmin: false, isParticipant: true, isReady: participantInfo.isReady};

        try {
            let gameState = await this.getRoomGameState(roomId);

            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${this.fireUser.uid}`, {
                passcode: passcode,
                state: WAIT_LIST_STATES.WAITING,
            });
            console.log(`Added ${this.fireUser.uid} to WaitList of room ${roomId}`);

            return {isAdmin: false, isParticipant: false, gameState: gameState};
        } catch (e) {
            console.log(e);
        }
        return false
    }

    /**
     * **Participant only operation** - Leave the room
     */  
    async leaveRoom(roomId) {
        console.log(`Leaving room ${roomId}`);
        try {
            await this._removeData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${this.fireUser.uid}`);
            console.log(`Removed ${this.fireUser.uid} from LobbyList`);
        } catch (e) {
            console.log(e);
        }
        try {
            await this._removeData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${this.fireUser.uid}`);
            console.log(`Removed ${this.fireUser.uid} from WaitList`);
        } catch (e) {
            console.log(e);
        }
        return true;
    }

    /**
     * **Admin only operation** - Close the room
     */  
    async closeRoom(roomId) {
        console.log(`Closing room ${roomId}`);
        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ACTIVE_TIME}`, -1); 
            console.log(`Room ${roomId} is closed`);
        } catch (e) {
            console.log(e);
        }
        return true;
    }

    /**
     * **Admin only operation** - Update the room active time
     * TODO: USE THIS WHEN ADMIN IS IN GAME
     */  
    async updateRoomActiveTime(roomId) {
        console.log(`Closing room ${roomId}`);
        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ACTIVE_TIME}`, Date.now()); 
            console.log(`Room ${roomId} is closed`);
        } catch (e) {
            console.log(e);
        }
        return true;
    }

    async getParticipantOfRoom(roomId) {
        console.log(`Fetching participant information for ${this.fireUser.uid}`);
        try {
            return await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${this.fireUser.uid}`);
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    async updateParticipantReady(roomId, readyState) {
        return await this._updateParticipantInfo(roomId, {
            isReady: readyState ? true : false
        });
    }

    async updateParticipantRole(roomId, uid, newRole) {
        if(!newRole || !Object.values(GAME_ROLES).includes(newRole)) {
            console.log(`${newRole} is not a valid game role`);
            return false;
        }
        return await this._updateParticipantInfo(roomId, {
            role: newRole,
            roleImgCode: getRandomElementFromArray(PROFILE_IMAGES_CODES[newRole])
        }, uid);
    }

    async _updateParticipantInfo(roomId, participantInfo, uid = null) {
        try {
            let uidToSet = uid ? uid : this.fireUser.uid;
            await this._updateData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${uidToSet}`, participantInfo);
            Object.entries(participantInfo).forEach((infoKeyValue) => {
                console.log(`Set ${uidToSet} ${infoKeyValue[0]} to "${infoKeyValue[1]}" in lobby`);
            });
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Admin only operation** - initializes the game
     */
    async initializeGame(roomId) {
        console.log("=== INITIALIZING GAME ===");
        let initializeGameState = GAME_STATES.GAME_INIT
        await this._setGameState(roomId, initializeGameState);
        return initializeGameState;
    }

    /**
     * **Admin only operation** - starts the game
     */
    async startGame(roomId) {
        console.log("=== STARTING GAME ===");
        await this._setGameState(roomId, GAME_STATES.GAME_STARTED);
    }

    /**
     * **Admin only operation** - goes to lobby
     */
    async leaveGame(roomId) {
        console.log("=== LEAVING GAME ===");
        await this._setGameState(roomId, GAME_STATES.LOBBY);
    }


    /**
     * **Admin only operation** - closes the game - sets to game END state
     */
    async endGame(roomId) {
        console.log("=== ENDING GAME ===");
        await this._setGameState(roomId, GAME_STATES.END);
    }

    /**
     * **Admin only operation** - sets the game state
     */    
    async _setGameState(roomId, gameState) {
        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_STATE}`, gameState);
        } catch (e) {
            console.log(e);
        }
    }

    /**
     * **Admin only operation** - Creates a new room
     */    
    async createRoom() {
        let defaultAdminData = {
            id: this.fireUser.uid,
        }

        let defaultActiveTime = Date.now();
        let defaultLockedState = false;
        let defaultGameState = GAME_STATES.LOBBY;
        let defaultBlockList = {};
        let defaultGameSettings = new LeagueKookGameSettings();

        let roomId = RoomUtils.generateRoomCode();
        let roomPasscode = RoomUtils.generateRoomPasscode();

        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ADMIN}`, defaultAdminData);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ACTIVE_TIME}`, defaultActiveTime);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOCKED}`, defaultLockedState);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_STATE}`, defaultGameState);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_BLOCK_LIST}`, defaultBlockList);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_PASSCODE}`, roomPasscode);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_SETTINGS}`, defaultGameSettings.toFireFormat());

        await this.addToLobbyList(roomId, GAME_ROLES.ADMIN, true);
        
        console.log(`Created room ${roomId} for ${this.fireUser.uid}`);

        return {
            roomId: roomId,
            roomPasscode: roomPasscode,
            isAdmin: true,
            isParticipant: true,
            isRoomLocked: defaultLockedState,
            gameState: defaultGameState,
        }
    }

    async getRoomState(roomId) {
        console.log(`Fetching room ${roomId} information`);
        try {
            let pass = await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_PASSCODE}`);
            let locked = await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOCKED}`);
            let gameState = await this.getRoomGameState(roomId);

            return {passcode: pass, isRoomLocked: locked, gameState: gameState};
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    async getRoomGameState(roomId) {
        try {
            return await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_STATE}`);
        } catch (e) {
            console.log(e);
        }
        return null;
    }

    async getGameSettings(roomId) {
        console.log("Fetching game settings")
        try {
            return await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_SETTINGS}`);
        } catch (e) {
            console.log(e);
        }
        return null;
    }

    /**
     * **Admin only operation** - Lock or Unlock the room for joining
     */
    async setRoomLock(roomId, lockState) {
        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOCKED}`, lockState ? true : false);
            console.log(`Set room ${roomId} lock to ${lockState}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Admin operation** - Adds a user to the lobbyList 
     */
    async addToLobbyList(roomId, uid, isAdmin = false) {
        let defaultUserReady = isAdmin;
        let defaultGameRole = isAdmin ? GAME_ROLES.ADMIN : GAME_ROLES.MCQ;
        let randomRoleImgCode = getRandomElementFromArray(PROFILE_IMAGES_CODES[defaultGameRole]);

        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${uid}`, {
                isReady: defaultUserReady,
                role: defaultGameRole,
                roleImgCode: randomRoleImgCode,
            });
            console.log(`Added ${uid} to room ${roomId} lobby`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Participant only operation** - Runs callback when game has started changes
     */  
    attachParticipantGameStartListener(roomId, gameStateStartedCallback) {
        console.log("Attaching participant listener for GameState");
        var callback = async (gameState) => {
            if(gameState && GameUtils.hasGameStarted(gameState)) {
                await gameStateStartedCallback(gameState);
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_STATE}`, callback);
    }

    /**
     * **Participant only operation** - Lists to game state changes
     */  
    attachGameStateListener(roomId, gameStateChangedCallback) {
        console.log("Attaching listener for GameState");
        var callback = async (gameState) => {
            if(gameState) {
                await gameStateChangedCallback(gameState);
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_STATE}`, callback);
    }

    /**
     * **Participant only operation** - Listens to Waitlist state changes
     */  
    attachParticipantWaitListListener(roomId, waitlistRemoveCallback) {
        console.log("Attaching participant listener for WaitList");
        var callback = async (data) => {
            if(data && data.state && data.state === WAIT_LIST_STATES.ADDED) {
                await waitlistRemoveCallback();
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${this.fireUser.uid}`, callback);
    }

    /**
     * **Admin only operation** - Attaches WaitList listener
     */
    attachAdminWaitListListener(roomId, gameState) {
        console.log(`Attaching admin listener for room ${roomId} WaitList`);
        var callback = async (data) => {
            if(GameUtils.isGameInLobby(gameState)) {
                console.log(`Change detected in Waitlist for room ${roomId}`)
                await this.moveWaitListUserToLobby(roomId, data);
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}`, callback);
    }

    /**
     * **Admin only operation** - Moves all waitList users to the lobbyList
     */
    async moveWaitListUserToLobby(roomId, data) {
        if(data) {
            await Object.entries(data).forEach(async (userData) => {
                let uid = userData[0];
                let state = userData[1].state;
                console.log(`Found ${uid} in Waitlist with state ${state}`);
                if (state === WAIT_LIST_STATES.WAITING && await this.addToLobbyList(roomId, uid)) {
                    await this.setWaitListUserToState(roomId, uid, WAIT_LIST_STATES.ADDED);
                }
            });
        }
    }

    /**
     * **Admin only operation** - Progresses user's waitlist state
     */
    async setWaitListUserToState(roomId, uid, state) {
        try {
            await this._updateData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${uid}`, {
                state: state,
            });
            console.log(`Set ${uid} state in Waitlist to ${state}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    attachLobbyListListener(roomId, callback) {
        console.log(`Attaching listener for room ${roomId} LobbyList`);
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}`, callback);
    }

    async getIsRoomActive(roomId) {
        console.log(`Checking if room ${roomId} is active`);
        try {
            let activeTime = await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ACTIVE_TIME}`);
            if(!RoomUtils.isRoomActive(activeTime)) return false;

            if(await this.isAdminOfRoom(roomId)) return {isAdmin: true, isParticipant: true};
            let participantInfo = await this.getParticipantOfRoom(roomId);
            if(participantInfo) return {isAdmin: false, isParticipant: true, isReady: participantInfo.isReady};

            return true;
        } catch (e) { 
            console.log(e);
        }
        return false;
    }

    //0wTG0Gewp2Xw2syg6KdQfnDnknb2_1700902705409
    async getQuestionBank(questionBankId) {
        console.log(`Fetching question bank with id ${questionBankId}`);
        try {
            return await this._getData(`/${this.PATHS.QUESTION_BANK}/${questionBankId}/${this.PATHS.QUESTION_BANK_QUESTIONS}`);
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    async addQuestionToQuestionBank(questionBankId, question) {
        console.log(`Adding to question bank with id ${questionBankId}`);
        try {
            return await this._pushData(`/${this.PATHS.QUESTION_BANK}/${questionBankId}/${this.PATHS.QUESTION_BANK_QUESTIONS}`, question.toFireFormat());
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Admin only operation** - Clear all comms for the room
     * TODO: move to storage instead of deleting?
     */  
    async clearRoomComms(roomId, lobbyUserList) {
        console.log(`Clearing comms in room ${roomId}`);
        try {
            await this._removeData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.GAME_COMMS_TO_ADMIN}`);
        } catch (e) {
            console.log(e);
        }
        try {
            //awaiting all deletions to finish
            await Promise.all(lobbyUserList.map(async (user) => {
                this._removeData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${user.uid}/${this.PATHS.LOBBY_USER_GAME_COMMS}/${this.PATHS.GAME_COMMS_TO_USER}`);
            }));
        } catch (e) {
            console.log(e);
        }
        return true;
    }


    /**
     * **Admin only operation** - Listens to game comms (from participants) changes
     */  
    attachAdminGameCommsListener(roomId, gameCommsChangedCallback) {
        console.log("Attaching admin listener for GameComms");
        var callback = async (comms) => {
            if (comms) {
                await gameCommsChangedCallback(comms);
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.GAME_COMMS_TO_ADMIN}`, callback);
    }

    /**
     * **Admin only operation** - Send game comm to participant (from admin)
     */
    async sendGameCommToParticipant(roomId, uid, comm) {
        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${uid}/${this.PATHS.LOBBY_USER_GAME_COMMS}/${this.PATHS.GAME_COMMS_TO_USER}/${comm.getCommId()}`, comm.toFireFormat());
            console.log(`Sent comm ${comm.toInfo()} to user ${uid} in room ${roomId}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Admin only operation** - Sets a game comm as processed
     */  
    async setAdminGameCommAsProcessed(roomId, commId) {
        try {
            await this._updateData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.GAME_COMMS_TO_ADMIN}/${commId}`, {commState: GAME_COMM_STATE.PROCESSED});

            console.log(`Marked comm {${commId}} as processed for admin in room ${roomId}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Participant only operation** - Listens to game comms (from admin) changes
     */  
    attachParticipantGameCommsListener(roomId, gameCommsChangedCallback) {
        console.log("Attaching participant listener for GameComms");
        var callback = async (comms) => {
            if (comms) {
                await gameCommsChangedCallback(comms);
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${this.fireUser.uid}/${this.PATHS.LOBBY_USER_GAME_COMMS}/${this.PATHS.GAME_COMMS_TO_USER}`, callback);
    }

    /**
     * **Participant only operation** - Send game comm to admin (from participant)
     */
    async sendGameCommToAdmin(roomId, comm) {
        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.GAME_COMMS_TO_ADMIN}/${comm.getCommId()}`, comm.toFireFormat());
            console.log(`Sent comm ${comm.toInfo()} to admin in room ${roomId}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Participant only operation** - Sets a game comm as processed
     */  
    async setParticipantGameCommAsProcessed(roomId, commId) {
        try {
            await this._updateData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${this.fireUser.uid}/${this.PATHS.LOBBY_USER_GAME_COMMS}/${this.PATHS.GAME_COMMS_TO_USER}/${commId}`, {commState: GAME_COMM_STATE.PROCESSED});

            console.log(`Marked comm {${commId}} as processed for user ${this.fireUser.uid} in room ${roomId}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    _onValue(path, callback) {
        if(!this.fireUser) {
            throw "Needs valid user to attach onValue listener";
        }

        //returns an unsubscriber that can be invoked
        return onValue(child(this.dbRef, path), async (snapshot) => {
            const data = snapshot.val();
            await callback(data);
        });
    }


    async _setData(path = "", data) {
        if(data === undefined || data === null) {
            throw "No data present";
        }

        if(!this.fireUser) {
            throw "No user present??";
        }
    
        await set(child(this.dbRef, path), data).catch((error) => {
            throw `(${error.code}) ${error.message}`;
        });
    }


    async _updateData(path = "", data) {
        if(data === undefined || data === null) {
            throw "No data present";
        }

        if(!this.fireUser) {
            throw "No user present??";
        }
    
        await update(child(this.dbRef, path), data).catch((error) => {
            throw `(${error.code}) ${error.message}`;
        });
    }


    async _pushData(path = "", data) {
        if(data === undefined || data === null) {
            throw "No data present";
        }

        if(!this.fireUser) {
            throw "No user present??";
        }
    
        return push(child(this.dbRef, path), data).catch((error) => {
            throw `(${error.code}) ${error.message}`;
        });
    }


    async _getData(path = "") {
        let out = null;

        if(!this.fireUser) {
            throw "No user present??";
        }

        await get(child(this.dbRef, path)).then((snapshot) => {
            if(snapshot.exists()) {
                out = snapshot.val();
            } else {
                throw {code: "snapshot", message: `No data available on path ${path}`};
            }
        }).catch((error) => {
            throw `(${error.code}) ${error.message}`;
        });
        return out;
    }

    async _removeData(path = "") {
        await remove(child(this.dbRef, path)).catch((error) => {
            throw `(${error.code}) ${error.message}`;
        });
    }
}

export const GAME_COMM_STATE = {
    WAITING: "waiting",
    PROCESSED: "processed"
}

export const GAME_COMM_TYPES = {
    /**
     * ADMIN to BARON
     * Use this comm type to initialize the BARON
     */
    INITIALIZE_BARON: "initializeBaron",
    /**
     * ADMIN to MCQ
     * Use this comm type to initialize the first MCQ question and team codes.
     */
    INITIALIZE_MCQ_QUESTION_AND_CODES: "initializeMCQQuestionCodes",
    /**
     * MCQ & BARON to ADMIN
     * Use this comm type to tell the admin initializing is ready
     */
    INITIALIZATION_DONE: "initializationDone",
    /**
     * MCQ to ADMIN
     * Use this comm type to verify the answer to an MCQ question
     */
    VERIFY_MCQ_ANSWER: "verifyMCQAnswer",
    /**
     * ADMIN to MCQ
     * Use this comm type to report the status of answer an MCQ question
     */
    REPORT_MCQ_ANSWER_VERIFICATION: "reportMCQAnswer",
    /**
     * MCQ to ADMIN
     * Use this comm type to request a new MCQ question
     */
    REQUEST_MCQ_QUESTION: "requestMCQQuestion",
    /**
     * ADMIN to MCQ
     * Use this comm type to assign an MCQ question to a user
     */
    ASSIGN_MCQ_QUESTION: "assignMCQQuestion",
    /**
     * BARON to ADMIN
     * Use this comm type to verify a baron attack code
     */
    VERIFY_BARON_CODE: "verifyBaronCode",
    /**
     * ADMIN to BARON
     * Use this comm type to report a baron attack code status
     */
    REPORT_BARON_CODE: "reportBaronCode",
    /**
     * ADMIN to MCQ
     * Use this comm type to notify MCQ of the last hit on BARON
     */
    NOTIFY_MCQ_END_GAME: "notifyMCQEndGame",
}

export class GameComm {
    constructor(fromUserId, commType, commMessage = null) {
        this.id = Date.now() + '_' + fromUserId;
        this.commType = commType;
        this.commMessage = commMessage;
    }

    getCommId() {
        return this.id;
    }

    toFireFormat() {
        let comm = {};
        if(this.commType === GAME_COMM_TYPES.INITIALIZE_BARON) {
            comm["data"] = {
                health: this.commMessage.health,
            }
        } else if(this.commType === GAME_COMM_TYPES.INITIALIZE_MCQ_QUESTION_AND_CODES) {
            comm["data"] = {
                question: this.commMessage.question,
                team: this.commMessage.team,
                teamCodes: this.commMessage.teamCodes,
                answerDuration: this.commMessage.answerDuration,
                lockoutDuration: this.commMessage.lockoutDuration,
            }
        } else if(this.commType === GAME_COMM_TYPES.INITIALIZATION_DONE) {
            comm["data"] = {
                fireUserUid: this.commMessage.fireUserUid
            }
        } else if(this.commType === GAME_COMM_TYPES.VERIFY_MCQ_ANSWER) {
            comm["data"] = {
                fireUserUid: this.commMessage.fireUserUid,
                answer: this.commMessage.answer,
            }
        } else if(this.commType === GAME_COMM_TYPES.REPORT_MCQ_ANSWER_VERIFICATION) {
            comm["data"] = {
                isCorrect: this.commMessage.isCorrect,
                baronCode: this.commMessage.baronCode,
            }
        } else if(this.commType === GAME_COMM_TYPES.REQUEST_MCQ_QUESTION) {
            comm["data"] = {
                fireUserUid: this.commMessage.fireUserUid,
            }
        } else if(this.commType === GAME_COMM_TYPES.ASSIGN_MCQ_QUESTION) {
            comm["data"] = {
                question: this.commMessage.question,
                team: this.commMessage.team,
            }
        } else if(this.commType === GAME_COMM_TYPES.VERIFY_BARON_CODE) {
            comm["data"] = {
                baronCode: this.commMessage.baronCode,
            }
        } else if(this.commType === GAME_COMM_TYPES.REPORT_BARON_CODE) {
            comm["data"] = {
                isValid: this.commMessage.isValid,
                damageAmount: this.commMessage.damageAmount,
                healthAfterDamage: this.commMessage.healthAfterDamage,
                team: this.commMessage.team,
                isLastHit: this.commMessage.isLastHit,
            }
        } else if(this.commType === GAME_COMM_TYPES.NOTIFY_MCQ_END_GAME) {
            comm["data"] = {
                winningTeam: this.commMessage.winningTeam,
            }
        } else {
            throw `Invalid comm type ${this.commType} for fire usage`;
        }
        comm["commType"] = this.commType;
        comm["commState"] = GAME_COMM_STATE.WAITING;
        return comm;
    }

    toInfo() {
        return `{${this.id}, ${this.commType}}`;
    }
}