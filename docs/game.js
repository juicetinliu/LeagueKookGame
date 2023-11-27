/**
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
import { generateRandomString, popRandomElementFromArray } from "./util.js";

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
    END: "end",
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
    hasGameStarted: (gameState) => { 
        return gameState === GAME_STATES.GAME_INIT || gameState === GAME_STATES.GAME_STARTED;
    },
    isGameInProgress: (gameState) => {
        return gameState === GAME_STATES.GAME_STARTED;
    },
    isLobbyOpen: (gameState) => { 
        return gameState === GAME_STATES.LOBBY;
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

const DefaultGameConstants = {
    minimumTeamComputers: RoomConstants.minMCQRoleCount/2,
    randomSequenceMultiplier: 2,
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
    constructor(fireUser) {
        super(fireUser);
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


/**
 * This game is only intialized/maintained/run by the ADMIN role.
 */
export class LeagueKookGame {
    constructor(app) {
        this.app = app;

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

        this.redTeamQuestions = [];
        this.blueTeamQuestions = [];

        this.minTeamComputers = DefaultGameConstants.minimumTeamComputers;
        this.randomSeqMultiplier = DefaultGameConstants.randomSequenceMultiplier;
    }

    setInitialParams(setupArgs) {
        this.lobbyUserList = setupArgs.lobbyUserList;
    }

    async initialize(setupArgs) {
        this.setInitialParams(setupArgs);
        //fetch baron or mcq users
        let filteredBaronUserList = this.lobbyUserList.filter(user => {
            return user.role === GAME_ROLES.BARON
        });
        if(filteredBaronUserList.length !== 1) throw `Expected one Baron user in lobby but got ${filteredBaronUserList}`;
        this.baronPlayer = new BaronPlayer(filteredBaronUserList[0]);
        this.mcqPlayerList = this.lobbyUserList.filter(user => {
            return user.role === GAME_ROLES.MCQ
        }).map(mcqUser => {
            return new MCQPlayer(mcqUser);
        });
        this.numMcqs = this.mcqPlayerList.length;

        this.assignTeamsToUnassignedMCQs();

        //TODO: MAKE THIS NOT A HARDCODED QUESTION BANK FOR MCQS
        let questionMap = await this.app.fire.getQuestionBank("0wTG0Gewp2Xw2syg6KdQfnDnknb2_1700902705409");
        console.log(questionMap);
        Object.entries(questionMap).forEach(questionInfo => {
            let questionId = questionInfo[0];
            let questionContent = questionInfo[1];
            try {
                this.questions.push(FireMCQQuestion.createFromFire(questionId, questionContent));
            } catch (e) { //do nothing for invalid-format questions
            }
        });
        console.log(this.questions);
        this.redTeamQuestions = this.questions.slice(0);
        this.blueTeamQuestions = this.questions.slice(0);

        this.assignQuestionsToMCQ();
        console.log(this.mcqPlayerList.map(mcq => {return mcq.toInfo()}));

        // //Sample game flow
        // this.mcqs.forEach(mcq => {mcq.completedQuestion()});
        // this.assignTeamsToUnassignedMCQs();
        // this.assignQuestionsToMCQ();
        // console.log(this.mcqs.map(c => {return [c.team, c.assignedQuestion.title]}));
        // this.mcqs.forEach(mcq => {mcq.completedQuestion()});
        // this.assignTeamsToUnassignedMCQs();
        // this.assignQuestionsToMCQ();
        // console.log(this.mcqs.map(c => {return [c.team, c.assignedQuestion.title]}));
    }

    /** 
     * Use after calling {@link assignTeamsToUnassignedMCQs}
     */
    assignQuestionsToMCQ() {
        this.mcqPlayerList.forEach(mcq => {
            if(mcq.needsQuestionAssignment()){
                let isTeamBlue = mcq.getAssignedTeam() === TEAM.BLUE;
                let teamQuestionList = isTeamBlue
                    ? this.blueTeamQuestions : this.redTeamQuestions;
                if(teamQuestionList.length === 0) {
                    console.log(`Team ${mcq.getAssignedTeam()} ran out of questions. Refreshing list`);
                    if(isTeamBlue) {
                        this.blueTeamQuestions = this.questions.slice(0);
                        teamQuestionList = this.blueTeamQuestions;
                    } else {
                        this.redTeamQuestions = this.questions.slice(0);
                        teamQuestionList = this.redTeamQuestions;
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
    getBaronPlayer() {
        return this.baronPlayer;
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
        this.mcqPlayerList.forEach(mcq => {
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
        let mcqsThatNeedAssignment = this.mcqPlayerList.filter(mcq => {
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

        console.log("Assigned teams to MCQs", mcqsThatNeedAssignment.map(c => {return c.team}));
    }
}