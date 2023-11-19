import { generateRandomString } from "./util.js";

export const WAIT_LIST_STATES = {
    /**
     * Participant joins, admin not yet processed
     */
    WAITING: "Waiting",
    /**
     * Admin processed, participant not yet acked
     */
    ADDED: "Added"
}

export const GAME_STATES = {
    LOBBY: "Lobby",
    GAME: "Game",
    END: "End",
}

const RoomConstants = {
    roomCodeLength: 6,
    roomCodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',

    roomPasscodeLength: 6,
    roomPasscodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',

    numBaronRole: 1,
    minMCQRoleCount: 2,


    roomActiveDuration: 3 * 60 * 60 * 1000, //3 hours until a room is considered "inactive"
}

export const RoomUtils = {
    generateRoomCode: () => {
        return generateRandomString(RoomConstants.roomCodeLength, RoomConstants.roomCodeCharacterPool);
    },
    generateRoomPasscode: () => {
        return generateRandomString(RoomConstants.roomPasscodeLength, RoomConstants.roomPasscodeCharacterPool);
    },
    isRoomActive: (activeTime) => {
        if(!activeTime) return false;
        return (Date.now() - activeTime) < RoomConstants.roomActiveDuration;
    }
}

export const GameUtils = {
    verifyGameStartCondition: (usersData) => {
        //ensure all users are ready
        let ret = usersData.every(user => {return user.isReady});

        //ensure game minimum requirements are met
        let numMCQ = 0;
        let numBaron = 0;
        usersData.forEach(user => {
            let role = user.role;
            if(role === GAME_ROLES.BARON) numBaron++;
            if(role === GAME_ROLES.MCQ) numMCQ++;
        });
        ret &= (numBaron === RoomConstants.numBaronRole && numMCQ >= RoomConstants.minMCQRoleCount);
        return ret;
    },
    convertRoleToDisplayString: (role) => {
        const stringMapping = {admin: "Admin", baron: "Baron", mcq: "MCQ"};
        return stringMapping[role];
    },
    // assignQuestions = (questions) => {}
}

export const GAME_ROLES = {
    ADMIN: "admin",
    BARON: "baron",
    MCQ: "mcq"
}

export const GAME_ROLE_SELECTION = {
    ADMIN: [GAME_ROLES.ADMIN, GAME_ROLES.BARON],
    NON_ADMIN: [GAME_ROLES.MCQ, GAME_ROLES.BARON],
}

export const ProfileUtils = {
    generateProfileImageFromCode: (code) => {
        return `assets/profiles/${code}.webp`;
    }
}

export const PROFILE_IMAGES_CODES = {
    admin: ["786"],
    baron: ["839"],
    mcq: ["778", "779", "780"]
}