import { Component, documentCreateElement, Element } from "../components.js";
import { GAME_ROLE_SELECTION, GAME_ROLES, GameUtils, PROFILE_IMAGES_CODES, ProfileUtils } from "../game.js";
import { Page } from "../page.js";

export class LobbyPage extends Page {
    constructor(app) {
        super("lobby-page", app);

        this.ROOM_INFO_ROOM_CODE_HEADER_TEXT = "Room ID:";
        this.ROOM_INFO_ROOM_PASSCODE_HEADER_TEXT = "Passcode:";
        
        this.roomInfoPanel = new Element("id", "lobby-room-info-panel");
        this.roomParticipantsPanel = new Element("id", "lobby-participants-panel");
        this.roomParticipantsContent = new Element("id", "lobby-room-participants-content");
        this.roomControlsPanel = new Element("id", "lobby-room-controls-panel");

        this.roomInfoUserRole = new Element("id", "lobby-room-info-user-role");
        this.roomInfoRoomCode = new Element("id", "lobby-room-info-room-code");
        this.roomInfoRoomPasscode = new Element("id", "lobby-room-info-room-passcode");

        this.roomControlsStartButton = new Element("id", "lobby-room-controls-start-button");
        this.roomControlsCloseButton = new Element("id", "lobby-room-controls-close-button");
        this.roomControlsReadyButton = new Element("id", "lobby-room-controls-ready-button");
        this.roomControlsLeaveButton = new Element("id", "lobby-room-controls-leave-button");
        this.roomControlsLockToggleButton = new Element("id", "lobby-room-controls-lock-toggle-button");
        this.roomControlsSettingsButton = new Element("id", "lobby-room-controls-settings-button");
        this.roomGoToGameButton = new Element("id", "lobby-room-controls-go-to-game-button");

        this.reset();
    }

    reset() {
        this.roomId = null;
        this.roomPasscode = null;
        this.isAdmin = false;
        this.isParticipant = false;
        this.isRoomLocked = false;
        this.isReady = false;
        this.gameState = null;
        this.gameStarted = false;
        this.lobbyUserList = [];
        this.participantProfileCards = [];
        if(this.waitListListener) {
            this.waitListListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous WaitList listener");
        }
        if(this.lobbyListListener) {
            this.lobbyListListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous LobbyList listener");
        }
        if(this.gameStartListener) {
            this.gameStartListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous GameStart listener");
        }
        if(this.participantRoleSwitcher) {
            this.participantRoleSwitcher.delete();
            console.log("Deleted role switcher");
        }
        this.participantRoleSwitcher = null;
        this.waitListListener = null;
        this.lobbyListListener = null;
        this.gameStartListener = null;
        super.reset();
    }

    async setup(setupArgs) {
        console.log("Setting up Lobby page");
        this.reset();
        await this.setRoomParametersAndPageState(setupArgs);
        this.setInitialRoomPageElements();
        this.updateRoomWhenParticipantsChange(null);

        if(this.gameStarted) console.log("Game already started; still setting up lobby");

        // Attach firebase listeners
        if(this.isAdmin) {   
            if(!this.gameStarted) {
                console.log("Making sure we move to lobby first");
                await this.app.fire.leaveGame(this.roomId);
                let gameState = await this.app.fire.getRoomGameState(this.roomId);
                this.saveGameStateToPageState(gameState);
            }
            this.waitListListener = this.app.fire.attachAdminWaitListListener(this.roomId, this.gameState);
            this.attachLobbyListListener();
            if(!this.gameStarted) {
                this.participantRoleSwitcher = new ParticipantRoleSwitcher(this, this.app);
                this.participantRoleSwitcher.create();
                this.participantRoleSwitcher.setup();
            }
        } else {
            this.roomControlsPanel.hide();
            if(this.isParticipant) {
                this.roomControlsPanel.show();
            } else {
                this.waitListListener = this.app.fire.attachParticipantWaitListListener(this.roomId, async () => {
                    await this.updateParamsAfterJoiningLobbyFromWaitlist();
                    this.attachLobbyListListener();
                    if(this.waitListListener) {
                        console.log("Unsubscribed WaitList Listener");
                        this.waitListListener();
                        this.roomControlsPanel.show();
                        this.waitListListener = null;
                    }
                });
            }
            if(!this.gameStarted) {
                this.gameStartListener = this.app.fire.attachParticipantGameStartListener(this.roomId, async (newGameState) => {
                    if(GameUtils.hasGameStarted(newGameState)) {
                        console.log("=== GAME STARTED ===");
                        this.saveGameStateToPageState(newGameState);
                        this.app.savePageStateToHistory(true);
                        await this.goToGamePage();
                    }
                });
            } else {
                console.log("Game has already started, not attaching GameStart listener");
            }
        }

        //We can reregister since we recreate the control panel content (listeners are lost)
        if(this.isAdmin) {
            if(this.gameStarted) {
            } else {
                this.roomControlsStartButton.addEventListener(["click"], async () => {
                    let newGameState = await this.app.fire.initializeGame(this.roomId);
                    this.saveGameStateToPageState(newGameState);
                    this.app.savePageStateToHistory(true);
                    await this.goToGamePage();
                    return;
                });
                this.roomControlsLockToggleButton.addEventListener(["click"], async () => {
                    let newRoomLockState = !this.isRoomLocked;
                    if(await this.app.fire.setRoomLock(this.roomId, newRoomLockState)) {
                        this.setRoomLockButton(newRoomLockState);
                        
                        this.isRoomLocked = newRoomLockState;
                        this.pageState.isRoomLocked = this.isRoomLocked;
                        this.app.savePageStateToHistory(true);
                    }
                    return;
                });
            }
            this.roomControlsCloseButton.addEventListener(["click"], async () => {
                await this.app.fire.closeRoom(this.roomId);
                this.pageState = {};
                await this.app.goToPage(this.app.pages.index, {}, {}, false);
                this.app.savePageStateToHistory(true);
                return;
            });
        } else {
            if(this.isParticipant) {
                this.attachLobbyListListener();
            }
            if(this.gameStarted) {
            } else {
                this.roomControlsReadyButton.addEventListener(["click"], async () => {
                    let newRoomReadyState = !this.isReady;
                    if(await this.app.fire.updateParticipantReady(this.roomId, newRoomReadyState)) {
                        this.setRoomReadyButton(newRoomReadyState);
                        
                        this.isReady = newRoomReadyState;
                        this.pageState.isReady = this.isReady;
                        this.app.savePageStateToHistory(true);
                    }
                    return;
                });
            }
            this.roomControlsLeaveButton.addEventListener(["click"], async () => {
                await this.app.fire.leaveRoom(this.roomId);
                this.reset();
                this.updateRoomWhenParticipantsChange(null);
                await this.app.goToPage(this.app.pages.index, {}, {}, false);
                this.app.savePageStateToHistory(true);
                return;
            });
        }
        if(this.gameStarted) {
            this.roomGoToGameButton.addEventListener(["click"], async () => {
                await this.goToGamePage();
                return;
            })
        }
        super.setup();
    }

    saveGameStateToPageState(newGameState) {
        this.gameState = newGameState;
        this.gameStarted = GameUtils.hasGameStarted(newGameState);

        this.pageState.gameState = this.gameState;
        this.pageState.gameStarted = this.gameStarted;
    }

    async goToGamePage() {
        let role = this.getCurrentUserGameRole();
        let gameSetupArgs = {roomId: this.roomId, isAdmin: this.isAdmin, lobbyUserList: this.lobbyUserList, roomPasscode: this.roomPasscode};
        console.log("Resetting lobby");
        this.reset();
        console.log("=== GOING TO GAME ===");
        if(role === GAME_ROLES.ADMIN) {
            await this.app.goToPage(this.app.pages.adminGame, gameSetupArgs);
        } else if (role === GAME_ROLES.BARON) {
            await this.app.goToPage(this.app.pages.baronGame, gameSetupArgs);
        } else if (role === GAME_ROLES.MCQ) {
            await this.app.goToPage(this.app.pages.mcqGame, gameSetupArgs);
        } else {
            console.log(`Invalid role: ${role}. Not going into game`);
        }
    }

    async updateParamsAfterJoiningLobbyFromWaitlist() {
        console.log("Joining lobby from waitlist and updating params");
        let fireGameState = await this.app.fire.getRoomGameState(this.roomId);
        this.saveGameStateToPageState(fireGameState);
        
        this.isParticipant = true;
        this.pageState.isParticipant = this.isParticipant;

        this.setup(this.pageState);
        this.app.savePageStateToHistory(true);
    }

    getCurrentUserGameRole() {
        if(!this.lobbyUserList || !this.lobbyUserList.length) {
            console.log("No game role found for this user.");
            return null;
        }
        let matchedUserList = this.lobbyUserList.filter(user => {
            return this.isAdmin 
                ? user.uid === GAME_ROLES.ADMIN
                : user.uid === this.app.fire.fireUser.uid
        });
        if(matchedUserList.length !== 1) {
            console.log(`Unexpectedly matched ${matchedUserList.length} users`);
        }
        return matchedUserList[0].role;
    }

    attachLobbyListListener() {
        this.lobbyListListener = this.app.fire.attachLobbyListListener(this.roomId, (data) => { 
            this.updateRoomWhenParticipantsChange(data); 
        });
    }

    setRoomLockButton(isRoomLocked) {
        this.roomControlsLockToggleButton.getElement().innerHTML = isRoomLocked ? "Unlock Room" : "Lock Room";
    }

    setInitialRoomPageElements() {
        this.roomInfoUserRole.getElement().innerHTML = this.isAdmin ? "👑 Admin" : "Participant"
        this.roomInfoRoomCode.getElement().innerHTML = this.roomId;
        this.roomInfoRoomPasscode.getElement().innerHTML = this.roomPasscode;
        this.roomControlsPanel.getElement().innerHTML = this.createRoomControlsPanelContent();
        if(this.gameStarted) {

        } else {
            if(this.isAdmin) {
                this.setRoomLockButton(this.isRoomLocked);
            } else {
                this.setRoomReadyButton(this.isReady);
            }
        }
    }


    setRoomReadyButton(isReady) {
        this.roomControlsReadyButton.getElement().innerHTML = isReady ? "Ready!" : "Not Ready!";
    }

    async setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;
        this.roomPasscode = setupArgs.roomPasscode;
        this.isAdmin = setupArgs.isAdmin;
        this.isParticipant = setupArgs.isParticipant;
        this.isRoomLocked = setupArgs.isRoomLocked;
        this.isReady = setupArgs.isReady;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.isAdmin = this.isAdmin;
        this.pageState.isParticipant = this.isParticipant;
        this.pageState.isRoomLocked = this.isRoomLocked;
        this.pageState.isReady = this.isReady;

        let gameState = await this.app.fire.getRoomGameState(this.roomId);
        this.saveGameStateToPageState(gameState);
    }

    updateRoomWhenParticipantsChange(data) {
        console.log("Updating participants list:", data);
        this.roomParticipantsContent.getElement().innerHTML = (!this.isAdmin && !this.isParticipant) ? this.createWaitingRoomContent() : this.createParticipantsPanelContent(data);
        this.participantProfileCards.forEach(card => {card.setup()});
        if(this.isAdmin && !this.gameStarted) {
            if(data) {
                let participantData = Object.values(data);
                let allowStart = GameUtils.verifyGameStartCondition(participantData);
                this.roomControlsStartButton.getElement().disabled = !allowStart;
            } else {
                this.roomControlsStartButton.getElement().disabled = true;
            }
        }
    }

    createWaitingRoomContent() {
        return `
            <div id="lobby-room-waiting-room-content" class="v vh-c hv-c">
                ${this.gameStarted ? "Game already started, please wait...": "Waiting to join room..."}
                <img id="lobby-room-waiting-room-loader" src="assets/ornn/ornn.gif"></img>
            </div>
        `;
    }

    createParticipantsPanelContent(participants) {
        this.lobbyUserList = [];
        this.participantProfileCards = [];

        if(participants) {
            Object.entries(participants).forEach(participantInfo => {
                let uid = participantInfo[0];
                let participantData = participantInfo[1];
                this.lobbyUserList.push(new FireUser(uid, participantData.isReady, participantData.role, participantData.roleImgCode));
            });
        }
        this.lobbyUserList.forEach(user => {
            this.participantProfileCards.push(ParticipantProfileCard.createFromProfile(user, this));
        });
        let participantsPanelContent = "";
        this.participantProfileCards.forEach(card => {
            participantsPanelContent += card.create();
        })
        return `${participantsPanelContent}`;
    }

    create() {
        let page = documentCreateElement("div", this.label, "page");

        page.innerHTML = `
            <div id="lobby-page-content" class="h hv-c vh-c">
                <div id="lobby-page-content-vert-wrapper" class="v vh-c hv-c">
                    ${this.createRoomInfoPanel()}
                    <div id="${this.roomParticipantsPanel.label}" class="panel h vh-c hv-c">
                        <div id="lobby-room-participants-background-image"></div>
                        <div id="${this.roomParticipantsContent.label}" class="h vh-t hv-l">
                        </div>
                    </div>
                    <div id="${this.roomControlsPanel.label}" class="panel">
                        ${this.createRoomControlsPanelContent()}
                    </div>
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

    createRoomInfoPanel() {
        return `
            <div id="${this.roomInfoPanel.label}" class="panel">
                <div id="lobby-page-user-role-content-row" class="lobby-page-room-info-panel-row h hv-c vh-c">
                    <div id="${this.roomInfoUserRole.label}" class="text-info">
                    </div>
                </div>
                <div id="lobby-page-room-code-content-row" class="lobby-page-room-info-panel-row h hv-c vh-c">
                    <div>${this.ROOM_INFO_ROOM_CODE_HEADER_TEXT} </div>
                    <div id="${this.roomInfoRoomCode.label}" class="text-info">
                    </div>
                </div>
                <div id="lobby-page-room-passcode-content-row" class="lobby-page-room-info-panel-row h hv-c vh-c">
                    <div>${this.ROOM_INFO_ROOM_PASSCODE_HEADER_TEXT} </div>
                    <div id="${this.roomInfoRoomPasscode.label}" class="text-info">
                    </div>
                </div>
            </div>
        `;
    }

    createRoomControlsPanelContent() {
        return `
            <div id="lobby-page-room-controls-content-row" class="h hv-c vh-c">
                ${(this.isAdmin) ? `
                    <button id="${this.roomControlsSettingsButton.label}">
                        Settings
                    </button>
                    ${this.gameStarted ? `
                        <button id="${this.roomGoToGameButton.label}">
                            Go to Game!
                        </button>
                    ` : `
                        <button id="${this.roomControlsLockToggleButton.label}">
                            Lock Room
                        </button>
                        <button id="${this.roomControlsStartButton.label}">
                            Start!
                        </button>
                    `}
                    <button id="${this.roomControlsCloseButton.label}">
                        Close
                    </button>
                ` : `
                    ${this.gameStarted ? `
                        <button id="${this.roomGoToGameButton.label}">
                            Go to Game!
                        </button>
                    ` : `
                        <button id="${this.roomControlsReadyButton.label}">
                            Ready!
                        </button>
                    `}
                    <button id="${this.roomControlsLeaveButton.label}">
                        Leave
                    </button>
                `}
            </div>
        `;
    }
}

class FireUser {
    constructor(uid, isReady, role, roleImgCode) {
        this.uid = uid;
        this.isReady = isReady;
        this.role = role;
        this.name = uid;
        this.profileImageSrc = ProfileUtils.generateProfileImageFromCode(roleImgCode);
    }
}

class ParticipantProfileCard extends Component {
    constructor(uid, isReady, role, profileImgSrc, page, app) {
        super("id", `participant-profile-card-${uid}`, page, app);
        this.uid = uid;
        this.isAdmin = uid === GAME_ROLES.ADMIN;
        this.isReady = isReady;
        this.role = role;
        this.roleString = GameUtils.convertRoleToDisplayString(this.role);
        this.profileImgSrc = profileImgSrc;
        this.isCurrentUser = uid === this.app.fire.fireUser.uid || (this.isAdmin && page.isAdmin);

        this.PROFILE_AVATAR_ID = `participant-profile-avatar-${uid}`;

        this.profileAvatar = new Element("id", this.PROFILE_AVATAR_ID);
    }

    setup() {
        if(this.page.isAdmin && !this.page.gameStarted) {
            this.profileAvatar.addEventListener(["click"], () => {
                let roleSwitcher = this.page.participantRoleSwitcher;
                roleSwitcher.updateRoleSwitcherOptions(this.uid, this.isAdmin, this.role);
                roleSwitcher.show();
                return;
            })
        }
        super.setup();
    }

    show() {
        super.show();
    }

    scrollCardToTop() {

    }

    static createFromProfile(user, page) {
        return new ParticipantProfileCard(user.uid, user.isReady, user.role, user.profileImageSrc, page, page.app);
    }

    create() {
        let out = `
            <div id="${this.label}" class="participant-profile-card ${this.isCurrentUser ? "this-user" : ""}">
                <div class="participant-profile-vert-wrapper v vh-c hv-c">
                    ${(this.isReady || this.isAdmin) ? `
                        <div class="participant-profile-ready-blocker">
                            ${this.isAdmin ? "👑" : "Ready!"}
                        </div>
                    ` : ""}
                    <div id="${this.profileAvatar.label}" class="participant-profile-avatar">
                        <div class="participant-profile-role-hover">
                            ${this.roleString}
                        </div>
                        <img class="participant-profile-avatar-image" src="${this.profileImgSrc}">
                        </img>
                    </div>
                    <div class="participant-profile-name">
                        ${this.isCurrentUser ? "You" : this.uid}
                    </div>
                </div>
            </div>
        `;
        super.create();
        return out;
    }
}

class ParticipantRoleSwitcher extends Component {
    constructor(page, app) {
        super("id", "participant-role-switcher", page, app);

        this.lightBox = new Element("id", this.label+"-lightbox");

        this.content = new Element("id", "participant-role-switcher-content");

        this.roleOptions = new Element("class", "role-switcher-selection-option");

        this.selectedUid = null;
        this.selectedRole = null;
    }

    show() {
        this.lightBox.show();
        super.show();
    }

    hide() {
        this.lightBox.hide();
        super.hide()
    }

    delete() {
        this.lightBox.delete();
        super.delete();
    }

    setup() {
        this.selectedUid = null;
        this.selectedRole = null;
        if(!this.setupCompleted) {
            this.lightBox.addEventListener(["click"], () => {
                this.hide();
            });
        }
        super.setup();
    }

    updateRoleSwitcherOptions(uid, isAdmin, role) {
        this.selectedUid = uid;
        this.selectedRole = role;
        this.content.getElement().innerHTML = this.createRoleSelectionDivs(isAdmin, role);
        this.roleOptions.addEventListener(["click"], async (e) => {
            let option = e.currentTarget;
            let newRole = option.dataset.chosenRole;
            if(this.selectedRole !== newRole) {
                console.log(`updating role for ${uid} from ${role} to ${newRole}`);
                await this.app.fire.updateParticipantRole(this.page.roomId, uid, newRole);
            }
            this.hide();
            return;
        });
    }

    createRoleAvatar(role, selectedRole) {
        let profileImgSrc = ProfileUtils.generateProfileImageFromCode(PROFILE_IMAGES_CODES[role][0]);
        let roleString = GameUtils.convertRoleToDisplayString(role);
        return `
            <div data-chosen-role="${role}" class="participant-profile-avatar ${this.roleOptions.label} ${selectedRole === role ? "this-role" : ""}">
                <div class="participant-profile-role-hover">
                    ${roleString}
                </div>
                <img class="participant-profile-avatar-image" src="${profileImgSrc}">
                </img>
            </div>
        `;
    }

    createRoleSelectionDivs(isAdmin, selectedRole) {
        let out = "";
        if (isAdmin) {
            GAME_ROLE_SELECTION.ADMIN.forEach(role => {
                out += this.createRoleAvatar(role, selectedRole);
            })
        } else {
            GAME_ROLE_SELECTION.NON_ADMIN.forEach(role => {
                out += this.createRoleAvatar(role, selectedRole);
            })
        }
        return out;
    }

    create() {
        if(!this.exists()) {
            let participantRoleSwitcher = documentCreateElement("div", this.label, ["panel", "hide", "v", "vh-c", "hv-c"]);
            participantRoleSwitcher.innerHTML = `
                    <div id="participant-role-switcher-header">
                        Switch roles
                    </div>
                    <div id="${this.content.label}" class="h hv-c vh-c">
                        ${this.createRoleSelectionDivs()}
                    </div>
                </div>
            `;

            let lightBox = documentCreateElement("div", this.lightBox.label, "hide");
            document.body.appendChild(participantRoleSwitcher);
            document.body.appendChild(lightBox);
            super.create();
        }
    }
}