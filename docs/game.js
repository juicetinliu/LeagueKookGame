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

const RoomConstants = {
    roomCodeLength: 6,
    roomCodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',

    roomPasscodeLength: 6,
    roomPasscodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',

    numBaronRole: 1,
    minMCQRoleCount: 2,


    roomActiveDuration: 3600000, //1 hour until a room is considered "inactive"
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
    verifyGameStartCondition: (adminData, usersData) => {
        let ret = usersData.every(user => {return user.isReady});
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
    }
}

export const GAME_ROLES = {
    ADMIN: "admin",
    BARON: "baron",
    MCQ: "mcq"
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