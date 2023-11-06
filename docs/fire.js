import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getDatabase, ref, child, get, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js"
import { GAME_ROLES, RoomUtils, WAIT_LIST_STATES } from "./game.js";

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

    async joinWaitList(roomId, passcode) {
        console.log(`Attempting to join waitList for room ${roomId}`);
        if(await this.isAdminOfRoom(roomId)) return {isAdmin: true};
        let participantInfo = await this.getParticipantOfRoom(roomId);
        if(participantInfo) return {isParticipant: true, isReady: participantInfo.isReady};

        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${this.fireUser.uid}`, {
                passcode: passcode,
                state: WAIT_LIST_STATES.WAITING,
            });
            console.log(`Added ${this.fireUser.uid} to waitlist of room ${roomId}`);

            return {isAdmin: false};
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
            console.log(`Removed ${this.fireUser.uid} from lobby`);
        } catch (e) {
            console.log(e);
        }
        try {
            await this._removeData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${this.fireUser.uid}`);
            console.log(`Removed ${this.fireUser.uid} from waitlist`);
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
            console.log(`Removed ${roomId} from lobby`);
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
        try {
            await this._updateData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${this.fireUser.uid}`, 
            {
                isReady: readyState ? true : false
            });
            console.log(`Set ${this.fireUser.uid} to isReady: ${readyState} in lobby`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Admin only operation** - Starts the game
     */    
    async startGame() {
        //TODOOOOO
    }

    /**
     * **Admin only operation** - Creates a new room
     */    
    async createRoom() {
        let defaultAdminData = {
            id: this.fireUser.uid,
            isBaron: false
        }

        let defaultActiveTime = Date.now();
        let defaultLockedState = false;
        let defaultBlockList = {};
        let defaultGameSettings = {};

        let roomId = RoomUtils.generateRoomCode();
        let roomPasscode = RoomUtils.generateRoomPasscode();

        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ADMIN}`, defaultAdminData);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ACTIVE_TIME}`, defaultActiveTime);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOCKED}`, defaultLockedState);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_BLOCK_LIST}`, defaultBlockList);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_PASSCODE}`, roomPasscode);
        await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_GAME_SETTINGS}`, defaultGameSettings);
        
        console.log(`Created room ${roomId} for ${this.fireUser.uid}`);

        return {
            roomId: roomId,
            roomPasscode: roomPasscode,
            isAdmin: true,
            isRoomLocked: defaultLockedState,
        }
    }

    async fetchRoomState(roomId) {
        console.log(`Fetching room ${roomId} information`);
        try {
            let pass = await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_PASSCODE}`);
            let locked = await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOCKED}`);

            return {passcode: pass, isRoomLocked: locked};
        } catch (e) {
            console.log(e);
        }
        return false;
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
    async addToLobbyList(roomId, uid) {
        let defaultUserReady = false;

        try {
            await this._setData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}/${uid}`, {
                isReady: defaultUserReady,
                role: GAME_ROLES.MCQ,
            });
            console.log(`Added ${uid} to room ${roomId} lobby`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    /**
     * **Participant only operation** - Listens to waitlist state changes
     */  
    attachParticipantWaitListListener(roomId, waitlistRemoveCallback) {
        console.log("Attaching participant listener for waitList");
        var callback = async (data) => {
            if(data && data.state && data.state === WAIT_LIST_STATES.ADDED) {
                await waitlistRemoveCallback();
            }
        }
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_WAIT_LIST}/${this.fireUser.uid}`, callback);
    }

    /**
     * **Admin only operation** - Attaches waitList listener
     */
    attachAdminWaitListListener(roomId) {
        console.log("Attaching admin listener for WaitList");
        var callback = async (data) => {
            await this.moveWaitListUserToLobby(roomId, data);
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
                console.log(`Found ${uid} in waitlist with state ${state}`);
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
            console.log(`Set ${uid} state in waitlist to ${state}`);
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    attachLobbyListListener(roomId, callback) {
        console.log("Attaching listener for LobbyList");
        return this._onValue(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}`, callback);
    }

    // async getLobbyList(roomId) {
    //     console.log(`Fetching room ${roomId} lobby list`)
    //     try {
    //         return await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_LOBBY_LIST}`);
    //     } catch (e) { 
    //         console.log(e);
    //     }
    //     return null;
    // }

    async isRoomActive(roomId) {
        console.log(`Checking if room ${roomId} is active`);
        try {
            if(await this.isAdminOfRoom(roomId)) return {isAdmin: true};
            let participantInfo = await this.getParticipantOfRoom(roomId);
            if(participantInfo) return {isParticipant: true, isReady: participantInfo.isReady};

            let activeTime = await this._getData(`/${this.PATHS.ROOMS}/${roomId}/${this.PATHS.ROOM_ACTIVE_TIME}`);
            return RoomUtils.isRoomActive(activeTime);
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