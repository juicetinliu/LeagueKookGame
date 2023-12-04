/**
 * Pages:
 *  - Lobby
 *  - Settings (game settings + question editor)
 *  - Game - MCQ
 *  - Game - Baron
 *  - Game - Admin
 * 
 * The Lobby
 *  - homescreen has options to create or join a room.
 *  - each computer generates a pcId (randomtext + timestamp -> hashed) stored in cookies
 *  
 *  - Create a room: admin computer opens the website; creates a room (with generated shortcode) and game object
 *      - firebase room opens
 *          - game settings are defaulted
 *          - "locked" is true
 *          - "gameState" is 0
 *          - admin role is set as pcId
 *               - only admin role has 'write' permissions
 *          - passcode to join room is generated
 *          - room active timestamp is created (this will be updated every hour the admin is active) -> used to delete a room/rooms when a user next opens the website (1 day TTL)
 *      - room shortcode and passcode displayed on admin's computer, along with participant edit list, game settings editor, "Un/Lock room" toggle , "End game", "Start game" 
 *          - looks like a league lobby
 *          - participants can be kicked/made admin
 *          - "locked" is now false
 *          - "Start game" only allowed when all participants are "ready"; and participant assignments follow contraints below
 * 
 *  - Join a room: participant computers can open the website and the room shortcode
 *      - they must input the correct passcode to join
 *      - can only join a room if "locked" is false, otherwise pushed back to homescreen
 *      - pcId is added to the paricipants for the room
 *          - limited to 'read' permissions for that room
 *      - room is displayed, along with participant list, "Leave room", "Ready/Unready"
 * 
 *  - Participants list - only editable by the admin; once game starts, this CANNOT change.
 *      - one computer is designated as the BARON computer (default first computer that joins)
 *      - the rest are MCQ computers
 *      - requires minimum 4 participants to start a game, 3 if ADMIN is also BARON
 *      - the ADMIN computer can also decide to select their role as BARON (or not)
 *          - If none are selected, then ADMIN computer can be used to track BARON health progress, play/pause game
 *          - If MCQ or BARON is selected, then ADMIN computer asks for a admin password (later used to resume ADMIN role) before moving back to game lobby screen
 *              - When in game, this computer will have an extra option to see admin page
 * 
 *  - e.g. 3 computers; [ADMIN/BARON][MCQ][MCQ]
 *         4 computers; [ADMIN],[BARON],[MCQ],[MCQ] OR [ADMIN/BARON],[MCQ],[MCQ],[MCQ]
 *         5 computers; [ADMIN],[BARON],[MCQ],[MCQ],[MCQ] OR [ADMIN/BARON],[MCQ],[MCQ],[MCQ],[MCQ]
 *         etc.
 * 
 * 
 * 
 *  The Game
 *  - Room (firebase)
 *      - Roles (ADMIN write access - updated when game starts, rest have read access)
 *           - <pcId> (listened to by specific pcId)
 *               - ready: boolean
 *               - role: BARON/MCQ
 *      - Game
 *          - baron-<pcId> (only ADMIN write access, rest have read access)
 *               - current health
 *               - attack codes [array]
 *                     - <attack code>
 *                           - team: <teamRed | teamBlue>
 *                           - timeGenerated: [TIME]
 *               - teamRed damage dealt [array of attacks]
 *               - teamBlue damage dealt [array of attacks]
 *          - mcq-<pcId> (listened to by specific pcId)
 *               - Current QuestionId
 *               - assignedTeam
 *               - assignedTime
 *               - timeout time
 *               - Answer input
 * 
 *          - teamRed
 *               - Questions unanswered [array of ids] (only ADMIN write access, rest have read access)
 *          - teamBlue
 *               - Questions unanswered [array of ids] (only ADMIN write access, rest have read access)
 *          - attackCode queue [indexed list]:
 *               - <AttackCode>
 *                      - []
 *      - Settings (only ADMIN write access, rest have read access)
 *          - Attack Point distribution - store bezier control points?
 *          - Attack Passcode expiry time
 *          - Game duration? Question amount? 
 *          - Baron Starting Health
 *          - MCQ assignment parameters
 *          - Team passwords
 * ADMIN starts the game
 *      - Participants list is compiled, and pcIds are added to the Roles along with correct Role and "ready" flags
 *      - Each computer listens to Roles/<pcId> for a change, and sets its own role
 *      - MCQ/BARON computers setup/render their pages; once ready, they mark their "ready" flag true 
 * ADMIN reads that all computers are "ready"
 *      - ADMIN creates Game object
 *      - Assigns MCQs to mcq-<pcId>
 * 
 * Questions:
 *  - title: <text>
 *  - correctAnswer: <text>
 *  - backgroundimg: <url>
 * 
 * 
 * MCQ assignment:
 *  - Total computers = N
 *  - Minimum team computers = T (CONFIGURABLE - minimum of 0; maximum of N/2)
 *  - Random Sequence multiplier = X (CONFIGURABLE)
 * 
 *  - ADMIN first assigns teamRed and teamBlue to random MCQ computers until at least T computers are teamRed and T computers are teamBlue
 *        - e.g. if there are 5 computers and T = 1; one computer is guaranteed to be teamBlue and one is guaranteed to be teamRed
 *  - The remaining MCQ computer count (N - T * 2) is totalled up and multiplied by 2 * X ; we'll call this number R = 2 * X * (N - T * 2)
 *  - Then a random list of size R of teamRed and teamBlue are generated (with equal amounts of teamRed and teamBlue). E.g.
 *        - 3 remaining computers and 2x = 2; list of size 6 is generated [teamRed, teamBlue, teamBlue, teamRed, teamBlue, teamRed]
 *        - 1 remaining computers and 2x = 2; list of size 2 is generated [teamBlue, teamRed]
 *        - ensures that each team will at least randomly appear equal amount of times (instead of pure random assignment which could for example assign teamRed 10 times in a row)
 *        - X determines how likely a continued sequence of ONE team appears
 *             - e.g. if X = 1; then it's guaranteed that every "round" of assignments will have an equal amount of teamRed and teamBlue
 *             - e.g. if X = 10; then it's likely that a "round" of assignment can assign ALL MCQ computers (after the T minimum ones) teamRed.
 *  - The first N - T * 2 items in that list are then popped and assigned to the remaining MCQ computers
 * 
 *  WHEN a question is answered OR times out; we follow the below when deciding what team to assign to the free MCQ computer:
 *    - Are there at least T teamRed and T teamBlue assigned MCQ computers? 
 *    - If YES:
 *          - pick next team from generated list; if list is empty, regenerate a list.
 *    - If NO:
 *          - assign teamA/teamB depending on which is not present at all
 *  
 * EXAMPLE GAME:
 * teamRed = A ; teamBlue = B ; N = 4 ; T = 1 ; X = 2
 * MCQ computers 1 | 2 | 3 | 4
 * ADMIN assigns A | B | x | x 
 * ADMIN generates randomList(length = 2X = 4) = [A, B, B, B, A, B, A, A]
 * ADMIN assigns A | B | A | B       (A, B is removed from randomList)
 * randomList = [B, B, A, B, A, A]
 * 
 * Now assume MCQ computer 3 is answered:
 * Assigned      A | B | x | B
 * ADMIN assigns A | B | B | B       (B is removed from randomList)
 * randomList = [B, A, B, A, A]
 * 
 * Now assume MCQ computer 1 is answered (team A is too good!)
 * Assigned      x | B | B | B
 * ADMIN assigns A | B | B | B       (since minimum 1 computer must be A)
 * 
 * Now MCQ computer 4 is answered
 * Assigned      A | B | B | x
 * ADMIN assigns A | B | B | B       (B is removed from randomList)
 * randomList = [A, B, A, A]
 * 
 * etc!
 */

import { FireMCQQuestion } from "./question.js";
import { ONE_SECOND, generateRandomString, popRandomElementFromArray } from "./util.js";

export const WAIT_LIST_STATES = {
    /**
     * Participant joins, admin not yet processed
     */
    WAITING: "waiting",
    /**
     * Admin processed, participant not yet acked
     */
    ADDED: "added"
}

export const GAME_STATES = {
    LOBBY: "lobby",
    GAME_INIT: "gameInit",
    GAME_STARTED: "gameStarted",
    END: "end", //NOT NEEDED?
}

const RoomConstants = {
    roomCodeLength: 6,
    roomCodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',

    roomPasscodeLength: 6,
    roomPasscodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',

    numBaronRole: 1,
    minMCQRoleCount: 2,

    roomActiveDuration: 3 * 60 * 60 * ONE_SECOND, //3 hours until a room is considered "inactive"
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
    hasGameStarted: (gameState) => { 
        return gameState === GAME_STATES.GAME_INIT || gameState === GAME_STATES.GAME_STARTED;
    },
    isGameInProgress: (gameState) => {
        return gameState === GAME_STATES.GAME_STARTED;
    },
    isGameInLobby: (gameState) => {
        return gameState === GAME_STATES.LOBBY;
    },
    generateBaronCode: () => {
        return generateRandomString(GameConstants.baronCodeLength, GameConstants.baronCodeCharacterPool);
    },
    hasGameEnded: (gameState) => {
        return gameState === GAME_STATES.END || gameState === GAME_STATES.LOBBY;
    },
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

export const BaronDamageGenerator = {
    /**
     * Gaussian distribution
     * See https://stackoverflow.com/a/49434653 for details
     */
    GAUSSIAN: (min, max) => {
        let u = 0, v = 0;
        while(u === 0) u = Math.random() //Converting [0,1) to (0,1)
        while(v === 0) v = Math.random()
        let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v )
        num = num / 10.0 + 0.5 // Translate to 0 -> 1
        if (num > 1 || num < 0) 
          num = randn_bm(min, max) // resample between 0 and 1 if out of range
        
        else{
          num *= max - min // Stretch to fill range
          num += min // offset to min
        }
        return Math.round(num);
    },
    /**
     * Uniform distribution
     */
    UNIFORM: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    /**
     * Custom distribution (weightTable contains weighting for each number?)
     */
    CUSTOM: (min, max) => {
        //??
    }
}

export const GameConstants = {
    defaultMinimumTeamComputers: Math.round(RoomConstants.minMCQRoleCount/2),
    defaultRandomSequenceMultiplier: 2,

    baronCodeLength: 4,
    baronCodeCharacterPool: 'abcdefghijklmnopqrstuvwxyz0123456789',
    baronCodeActiveDuration: 5 * 60 * ONE_SECOND, // 5 minutes until baron code expires

    questionAnswerWindowDuration: 5 * 60 * ONE_SECOND, // 5 minutes before a question expires
    questionWrongLockoutDuration: 1 * 60 * ONE_SECOND, // 1 minute before a question can be retried

    baronStartingHealthAmount: 11400,
    defaultBaronDamageGenerator: BaronDamageGenerator.GAUSSIAN,
    baronCodeMaxDamageAmount: 1000,
    baronCodeMinDamageAmount: 10,
}

export const TEAM = {
    RED: "red",
    BLUE: "blue"
}

class Player {
    constructor(fireUser) {
        this.fireUser = fireUser;
    }
}

class BaronPlayer extends Player {
    constructor(fireUser, maxHealth) {
        super(fireUser);
        this.maxHealth = maxHealth;
        this.health = maxHealth;
    }

    getHealth() {
        return this.health;
    }

    /**
     * Constrains health to be at 0 if damage is greater than remaining health.
     */
    receiveDamage(damageAmount) {
        this.health = Math.max(this.health - damageAmount, 0);
    }

    isDead() {
        return this.health <= 0;
    }

    revive() {
        this.health = this.maxHealth;
    }

    toInfo() {
        return [this.fireUser.uid, this.health];
    }
}

class MCQPlayer extends Player {
    constructor(fireUser) {
        super(fireUser);
        this.assignedTeam = null;
        this.assignedQuestion = null;
    }

    assignToTeam(team) {
        this.assignedTeam = team;
    }

    assignQuestion(question) {
        this.assignedQuestion = question;
    }

    getAssignedTeam() {
        return this.assignedTeam;
    }

    getAssignedQuestion() {
        return this.assignedQuestion;
    }

    completedQuestion() {
        this.assignedTeam = null;
        this.assignedQuestion = null;
    }

    needsTeamAssignment() {
        return this.assignedTeam === null;
    }

    needsQuestionAssignment() {
        return this.assignedQuestion === null;
    }

    toInfo() {
        return [this.fireUser.uid, this.assignedTeam, this.assignedQuestion.title];
    }
}

export class LeagueKookGameSettings {
    constructor(
        teamCodes = null,
        baronMaxHealth = null,
        baronCodeActiveDuration = null,
        baronCodeMaxDamageAmount = null,
        baronCodeMinDamageAmount = null,
        questionAnswerWindowDuration = null,
        questionWrongLockoutDuration = null) {
        this.teamCodes = teamCodes ? teamCodes : {};
        this.teamCodes[TEAM.BLUE] = "1234";
        this.teamCodes[TEAM.RED] = "4321";

        this.baronMaxHealth = baronMaxHealth ? baronMaxHealth : GameConstants.baronStartingHealthAmount;
        this.baronCodeActiveDuration = baronCodeActiveDuration ? baronCodeActiveDuration : GameConstants.baronCodeActiveDuration;
        this.baronCodeMaxDamageAmount = baronCodeMaxDamageAmount ? baronCodeMaxDamageAmount : GameConstants.baronCodeMaxDamageAmount;
        this.baronCodeMinDamageAmount = baronCodeMinDamageAmount ? baronCodeMinDamageAmount : GameConstants.baronCodeMinDamageAmount;

        this.questionAnswerWindowDuration = questionAnswerWindowDuration ? questionAnswerWindowDuration : GameConstants.questionAnswerWindowDuration;
        this.questionWrongLockoutDuration = questionWrongLockoutDuration ? questionWrongLockoutDuration : GameConstants.questionWrongLockoutDuration;

        this.minTeamComputers = GameConstants.defaultMinimumTeamComputers;
        this.randomSeqMultiplier = GameConstants.defaultRandomSequenceMultiplier;
        this.baronDamageGenerator = GameConstants.defaultBaronDamageGenerator;
    }

    setTeamCode(team, code) {

    }

    getTeamCodes() {
        return this.teamCodes;
    }

    static createFromFire(data) {
        return new LeagueKookGameSettings(
            data.teamCodes,
            data.baronMaxHealth,
            data.baronCodeActiveDuration,
            data.baronCodeMaxDamageAmount,
            data.baronCodeMinDamageAmount,
            data.questionAnswerWindowDuration,
            data.questionWrongLockoutDuration);
    }

    toFireFormat() {
        return {
            teamCodes: this.teamCodes,
            baronMaxHealth: this.baronMaxHealth,
            baronCodeActiveDuration: this.baronCodeActiveDuration,
            baronCodeMaxDamageAmount: this.baronCodeMaxDamageAmount,
            baronCodeMinDamageAmount: this.baronCodeMinDamageAmount,
            minTeamComputers: this.minTeamComputers,
            randomSeqMultiplier: this.randomSeqMultiplier,
            baronDamageGenerator: this.baronDamageGenerator,
        }
    }
}


/**
 * This game is only intialized/maintained/run by the ADMIN role.
 */
export class LeagueKookGame {
    constructor(app, gameSettings) {
        this.app = app;
        this.settings = gameSettings;

        this.reset();
    }

    reset() {
        this.roomId = null;
        this.lobbyUserList = [];
        this.mcqPlayerList = [];
        this.baronPlayer = null;
        this.numMcqs = 0;
        this.furtherTeamAssignmentsPool = [];
        this.questions = [];

        //Questionbank images urls are hardcoded (not stored/uploadable)
        this.questionBankId = "0wTG0Gewp2Xw2syg6KdQfnDnknb2_1700902705409";

        this.redTeamQuestionPool = [];
        this.blueTeamQuestionPool = [];

        this.baronCodeHistory = [];

        this.baronMaxHealth = this.settings.baronMaxHealth;
        this.baronCodeActiveDuration = this.settings.baronCodeActiveDuration;
        this.baronCodeMaxDamageAmount = this.settings.baronCodeMaxDamageAmount;
        this.baronCodeMinDamageAmount = this.settings.baronCodeMinDamageAmount;

        this.minTeamComputers = this.settings.minTeamComputers;
        this.randomSeqMultiplier = this.settings.randomSeqMultiplier;
        this.baronDamageGenerator = this.settings.baronDamageGenerator;
    }

    setInitialParams(setupArgs) {
        this.lobbyUserList = setupArgs.lobbyUserList;
        this.roomId = setupArgs.roomId;
    }

    async initialize(setupArgs) {
        this.setInitialParams(setupArgs);
        //fetch baron or mcq users
        let filteredBaronUserList = this.lobbyUserList.filter(user => {
            return user.role === GAME_ROLES.BARON
        });
        if(filteredBaronUserList.length !== RoomConstants.numBaronRole) {
            console.log(`Expected ${RoomConstants.numBaronRole} Baron user(s) from the lobby but got ${filteredBaronUserList}`);
            return false;
        }
        this.baronPlayer = new BaronPlayer(filteredBaronUserList[0], this.baronMaxHealth);

        this.mcqPlayerList = this.lobbyUserList.filter(user => {
            return user.role === GAME_ROLES.MCQ
        }).map(mcqUser => {
            return new MCQPlayer(mcqUser);
        });
        this.numMcqs = this.getMCQPlayerList().length;
        if(this.numMcqs < RoomConstants.minMCQRoleCount) {
            console.log(`Expected at least ${RoomConstants.minMCQRoleCount} MCQ user(s) from the lobby but got ${this.numMcqs}`);
            return false;
        }

        this.assignTeamsToUnassignedMCQs();

        //TODO: MAKE THIS NOT A HARDCODED QUESTION BANK FOR MCQS
        let questionMap = await this.app.fire.getQuestionBank(this.questionBankId);
        console.log(questionMap);
        Object.entries(questionMap).forEach(questionInfo => {
            let questionId = questionInfo[0];
            let questionContent = questionInfo[1];
            try {
                this.questions.push(FireMCQQuestion.createFromFire(questionId, questionContent));
            } catch (e) { //ignore invalidly-formatted questions
            }
        });
        if(this.questions.length < 1) {
            console.log(`No questions available for the game`);
            return false;
        }
        this.redTeamQuestionPool = this.questions.slice(0);
        this.blueTeamQuestionPool = this.questions.slice(0);

        this.assignQuestionsToMCQs();
        console.log(this.getMCQPlayerList().map(mcq => {return mcq.toInfo()}));

        // //Sample game flow
        // this.mcqs.forEach(mcq => {mcq.completedQuestion()});
        // this.assignTeamsToUnassignedMCQs();
        // this.assignQuestionsToMCQs();
        // console.log(this.mcqs.map(c => {return [c.team, c.assignedQuestion.title]}));
        // this.mcqs.forEach(mcq => {mcq.completedQuestion()});
        // this.assignTeamsToUnassignedMCQs();
        // this.assignQuestionsToMCQs();
        // console.log(this.mcqs.map(c => {return [c.team, c.assignedQuestion.title]}));
        return true;
    }

    /** 
     * Use after calling {@link assignTeamsToUnassignedMCQs}
     */
    assignQuestionsToMCQs() {
        this.getMCQPlayerList().forEach(mcq => {
            if(mcq.needsQuestionAssignment()){
                let isTeamBlue = mcq.getAssignedTeam() === TEAM.BLUE;
                let teamQuestionList = isTeamBlue
                    ? this.blueTeamQuestionPool : this.redTeamQuestionPool;
                if(teamQuestionList.length === 0) {
                    console.log(`Team ${mcq.getAssignedTeam()} ran out of questions. Refreshing list`);
                    if(isTeamBlue) {
                        this.blueTeamQuestionPool = this.questions.slice(0);
                        teamQuestionList = this.blueTeamQuestionPool;
                    } else {
                        this.redTeamQuestionPool = this.questions.slice(0);
                        teamQuestionList = this.redTeamQuestionPool;
                    }
                } 
                let question = popRandomElementFromArray(teamQuestionList);
                mcq.assignQuestion(question);
            }
        });
    }

    getMCQPlayerList() {
        return this.mcqPlayerList;
    }

    fetchMCQPlayerForFireUser(fireUserUid) {
        let assignedMCQPlayerList = this.getMCQPlayerList().filter(mcq => {
            return mcq.fireUser.uid === fireUserUid;
        });
        if(assignedMCQPlayerList.length !== 1) throw `Expected only one user to match but got ${assignedMCQPlayerList.length}`;
        return assignedMCQPlayerList[0];
    }

    getBaronPlayer() {
        return this.baronPlayer;
    }

    getBaronCodeActiveDuration() {
        return this.baronCodeActiveDuration;
    }

    generateBaronCode() {
        let baronCode = GameUtils.generateBaronCode();
        console.log(`Generated baron code: ${baronCode}`)
        while (this.baronCodeHistory.some(log => {return log.baronCode === baronCode})) {
            baronCode = GameUtils.generateBaronCode();
            console.log(`Regenerated baron code: ${baronCode}`);
        }
        return baronCode;
    }

    verifyDeactivateAndReturnBaronCodePackage(baronCode) {
        let validCodeList = this.baronCodeHistory.filter(baronCodePackage => {
            return baronCodePackage.active && Date.now() <= baronCodePackage.expiryTime && baronCodePackage.baronCode === baronCode;
        });
        if(!validCodeList.length || validCodeList.length === 0) {
            console.log(`Baron code ${baronCode} is not valid`);
            return false;
        } else {
            validCodeList.forEach(baronCodePackage => {
                baronCodePackage.active = false;
            })
            if(validCodeList.length > 1) {
                console.log(`${validCodeList.length} baron codes found when 1 was expected. Shouldn't be possible. Marked them as inactive.`);
                return false;
            }
        }
        console.log(`Baron code ${baronCode} is valid`);
        return validCodeList[0];
    }

    damageBaronAndVerifyDeath(damageAmount) {
        let baronPlayer = this.getBaronPlayer();
        baronPlayer.receiveDamage(damageAmount);
        return baronPlayer.isDead();
    }

    generateBaronDamageAmount() {
        return this.baronDamageGenerator(this.baronCodeMinDamageAmount, this.baronCodeMaxDamageAmount);
    }

    addToBaronCodeHistory(baronCodePackage) {
        if(!baronCodePackage.baronCode || !baronCodePackage.team || !baronCodePackage.expiryTime) throw `Baron code package missing valid arguments: ${[baronCodePackage.baronCode, baronCodePackage.team, baronCodePackage.expiryTime]}`;

        this.baronCodeHistory.push(baronCodePackage);
    }

    generateTeamAssignmentsPool() {
        console.log("Generating team assignment pool");
        let numRemainingUnassignedComputers = this.numMcqs - (this.minTeamComputers * 2);
        if(numRemainingUnassignedComputers < 0) throw `Number of remaining unassigned computers should be >= 0 but got ${numRemainingUnassignedComputers}`;
        
        let teamAssignmentPool = []

        for(let i = 0; i < numRemainingUnassignedComputers * this.randomSeqMultiplier; i++) {
            teamAssignmentPool.push(TEAM.BLUE);
            teamAssignmentPool.push(TEAM.RED);
        }

        return teamAssignmentPool;
    }

    addMinimumTeamComputers(teamAssignments = []) {
        let teamRedCount = 0;
        let teamBluecount = 0;
        this.getMCQPlayerList().forEach(mcq => {
            if(mcq.team === TEAM.BLUE) teamBluecount++;
            if(mcq.team === TEAM.RED) teamRedCount++;
        });

        for(let r = teamRedCount; r < this.minTeamComputers; r++) {
            teamAssignments.push(TEAM.RED);
        }
        for(let b = teamBluecount; b < this.minTeamComputers; b++) {
            teamAssignments.push(TEAM.BLUE);
        }
        return teamAssignments;
    }

    assignTeamsToUnassignedMCQs() {
        let teamAssignments = this.addMinimumTeamComputers();

        //First apply minimum assignment rules
        let mcqsThatNeedAssignment = this.getMCQPlayerList().filter(mcq => {
            return mcq.needsTeamAssignment();
        });

        let numMcqsNeedingPooledAssignments = mcqsThatNeedAssignment.length - teamAssignments.length;
        //Determine whether pool has enough left for full assignment, otherwise only assign what's left in the pool.
        let numAssignmentsLeftInPool = this.furtherTeamAssignmentsPool.length - numMcqsNeedingPooledAssignments;
        let numAvailableAssignmentsLeft = numAssignmentsLeftInPool >= 0 ? numMcqsNeedingPooledAssignments : this.furtherTeamAssignmentsPool.length;
        for(let i = 0; i < numAvailableAssignmentsLeft; i++) {
            teamAssignments.push(popRandomElementFromArray(this.furtherTeamAssignmentsPool));
        }

        //The pool needs to be regenerated
        if(numAssignmentsLeftInPool <= 0) {
            this.furtherTeamAssignmentsPool = this.generateTeamAssignmentsPool();            
            //If there were still more mcqs that need assignment take it from the pool.
            for(let j = 0; j < -numAssignmentsLeftInPool; j++) {
                teamAssignments.push(popRandomElementFromArray(this.furtherTeamAssignmentsPool));
            }
        }

        mcqsThatNeedAssignment.forEach(mcq => {
            mcq.assignToTeam(popRandomElementFromArray(teamAssignments));
        })

        console.log("Assigned teams to MCQs", mcqsThatNeedAssignment.map(c => {return c.assignedTeam}));
    }
}