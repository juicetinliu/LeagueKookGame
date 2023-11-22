import { Component, documentCreateElement, Element } from "../components.js";
import { GAME_ROLE_SELECTION, GAME_ROLES, GameUtils, PROFILE_IMAGES_CODES, ProfileUtils } from "../game.js";
import { Page } from "../page.js";

export class LobbyPage extends Page {
    constructor(app) {
        super("lobby-page", app);

        this.ROOM_INFO_ROOM_CODE_HEADER_TEXT = "Room ID:";
        this.ROOM_INFO_ROOM_PASSCODE_HEADER_TEXT = "Passcode:";

        let ROOM_INFO_PANEL_ID = "lobby-room-info-panel";
        let PARTICIPANTS_PANEL_ID = "lobby-participants-panel";
        let ROOM_CONTROLS_PANEL_ID = "lobby-room-controls-panel";

        let ROOM_INFO_USER_ROLE_ID = "lobby-room-info-user-role";
        let ROOM_INFO_ROOM_CODE_ID = "lobby-room-info-room-code";
        let ROOM_INFO_ROOM_PASSCODE_ID = "lobby-room-info-room-passcode";

        let ROOM_START_BUTTON_ID = "lobby-room-controls-start-button";
        let ROOM_CLOSE_BUTTON_ID = "lobby-room-controls-close-button";
        let ROOM_READY_BUTTON_ID = "lobby-room-controls-ready-button";
        let ROOM_LEAVE_BUTTON_ID = "lobby-room-controls-leave-button";
        let ROOM_LOCK_TOGGLE_BUTTON_ID = "lobby-room-controls-lock-toggle-button";
        let ROOM_SETTINGS_BUTTON_ID = "lobby-room-controls-settings-button";
        let GO_TO_GAME_BUTTON_ID = "lobby-room-controls-go-to-game-button";
        
        this.roomInfoPanel = new Element("id", ROOM_INFO_PANEL_ID);
        this.roomParticipantsPanel = new Element("id", PARTICIPANTS_PANEL_ID);
        this.roomControlsPanel = new Element("id", ROOM_CONTROLS_PANEL_ID);

        this.roomInfoUserRole = new Element("id", ROOM_INFO_USER_ROLE_ID);
        this.roomInfoRoomCode = new Element("id", ROOM_INFO_ROOM_CODE_ID);
        this.roomInfoRoomPasscode = new Element("id", ROOM_INFO_ROOM_PASSCODE_ID);

        this.roomControlsStartButton = new Element("id", ROOM_START_BUTTON_ID);
        this.roomControlsCloseButton = new Element("id", ROOM_CLOSE_BUTTON_ID);
        this.roomControlsReadyButton = new Element("id", ROOM_READY_BUTTON_ID);
        this.roomControlsLeaveButton = new Element("id", ROOM_LEAVE_BUTTON_ID);
        this.roomControlsLockToggleButton = new Element("id", ROOM_LOCK_TOGGLE_BUTTON_ID);
        this.roomControlsSettingsButton = new Element("id", ROOM_SETTINGS_BUTTON_ID);
        this.roomGoToGameButton = new Element("id", GO_TO_GAME_BUTTON_ID);

        this.reset();
    }

    reset() {
        this.roomId = null;
        this.roomPasscode = null;
        this.isAdmin = false;
        this.isRoomLocked = false;
        this.isReady = false;
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
        if(this.gameStateListener) {
            this.gameStateListener(); //unsubscribes the listener.
            console.log("Unsubscribed previous GameState listener");
        }
        if(this.participantRoleSwitcher) {
            this.participantRoleSwitcher.delete();
            console.log("Deleted role switcher");
        }
        this.participantRoleSwitcher = null;
        this.waitListListener = null;
        this.lobbyListListener = null;
        this.gameStateListener = null;
        super.reset();
    }

    setup(setupArgs) {
        this.reset();
        this.setRoomParametersAndPageState(setupArgs);
        this.setInitialRoomPageElements();

        if(this.gameStarted) console.log("Game already started; still setting up lobby");

        // Attach firebase listeners
        if(this.isAdmin) {
            this.waitListListener = this.app.fire.attachAdminWaitListListener(this.roomId);
            this.attachLobbyListListener();
            if(!this.gameStarted) {
                this.participantRoleSwitcher = new ParticipantRoleSwitcher(this, this.app);
                this.participantRoleSwitcher.create();
                this.participantRoleSwitcher.setup();
            }
        } else {
            this.waitListListener = this.app.fire.attachParticipantWaitListListener(this.roomId, () => {
                this.attachLobbyListListener();
                if(this.waitListListener) {
                    console.log("Unsubscribed WaitList Listener");
                    this.waitListListener();
                    this.waitListListener = null;
                }
            });
            if(!this.gameStarted) {
                this.gameStateListener = this.app.fire.attachParticipantGameStateListener(this.roomId, () => {
                    console.log("=== GAME STARTED ===");
                    this.gameStarted = true;
                    this.pageState.gameStarted = this.gameStarted;
                    this.app.savePageStateToHistory(true);
                    this.goToGamePage();

                    if(this.gameStateListener) {
                        console.log("Unsubscribed GameState Listener");
                        this.gameStateListener();
                        this.gameStateListener = null;
                    }
                });
            } else {
                console.log("Game has already started, not attaching GameState listener");
            }
        }

        this.updateRoomWhenParticipantsChange(null);

        //We can reregister since we recreate the control panel content (listeners are lost)
        if(this.isAdmin) {
            if(this.gameStarted) {
            } else {
                this.roomControlsStartButton.addEventListener(["click"], async () => {
                    await this.app.fire.startGame(this.roomId);
                    this.gameStarted = true;
                    this.pageState.gameStarted = this.gameStarted;
                    this.app.savePageStateToHistory(true);
                    this.goToGamePage();
                });
                this.roomControlsLockToggleButton.addEventListener(["click"], async () => {
                    let newRoomLockState = !this.isRoomLocked;
                    if(await this.app.fire.setRoomLock(this.roomId, newRoomLockState)) {
                        this.setRoomLockButton(newRoomLockState);
                        this.isRoomLocked = newRoomLockState;

                        this.pageState.isRoomLocked = this.isRoomLocked;
                        this.app.savePageStateToHistory(true);
                    }
                });
            }
            this.roomControlsCloseButton.addEventListener(["click"], async () => {
                await this.app.fire.closeRoom(this.roomId);
                this.pageState = {};
                this.app.goToPage(this.app.pages.index, {}, {}, false);
                this.app.savePageStateToHistory(true);
            });
        } else {
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
                });
            }
            this.roomControlsLeaveButton.addEventListener(["click"], async () => {
                await this.app.fire.leaveRoom(this.roomId);
                this.reset();
                this.updateRoomWhenParticipantsChange(null);
                this.app.goToPage(this.app.pages.index, {}, {}, false);
                this.app.savePageStateToHistory(true);
            });
        }
        if(this.gameStarted) {
            this.roomGoToGameButton.addEventListener(["click"], () => {
                this.goToGamePage();
            })
        }
        super.setup();
    }

    goToGamePage() {
        let role = this.getCurrentUserGameRole();
        let adminSetupArgs = {isAdmin: this.isAdmin};
        if(this.isAdmin) {
            adminSetupArgs["lobbyUserList"] = this.lobbyUserList;
        }
        if(role === GAME_ROLES.ADMIN) {
            this.app.goToPage(this.app.pages.adminGame, adminSetupArgs);
        } else if (role === GAME_ROLES.BARON) {
            this.app.goToPage(this.app.pages.baronGame, adminSetupArgs);
        } else if (role === GAME_ROLES.MCQ) {
            this.app.goToPage(this.app.pages.mcqGame);
        } else {
            console.log(`Invalid role: ${role}. Not going into game`);
        }
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
        this.roomInfoUserRole.getElement().innerHTML = this.isAdmin ? "Admin" : "Participant"
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

    setRoomParametersAndPageState(setupArgs) {
        this.roomId = setupArgs.roomId;
        this.roomPasscode = setupArgs.roomPasscode;
        this.isAdmin = setupArgs.isAdmin;
        this.isRoomLocked = setupArgs.isRoomLocked;
        this.isReady = setupArgs.isReady;
        this.gameStarted = setupArgs.gameStarted;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.isAdmin = this.isAdmin;
        this.pageState.isRoomLocked = this.isRoomLocked;
        this.pageState.isReady = this.isReady;
        this.pageState.gameStarted = this.gameStarted;
    }

    updateRoomWhenParticipantsChange(data) {
        console.log("Updating participants list:", data);
        this.roomParticipantsPanel.getElement().innerHTML = (!this.isAdmin && this.waitListListener) ? this.createWaitingRoomContent() : this.createParticipantsPanelContent(data);
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
                Waiting to join room...
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
                this.lobbyUserList.push(new User(uid, participantData.isReady, participantData.role, participantData.roleImgCode));
            });
        }
        this.lobbyUserList.forEach(user => {
            this.participantProfileCards.push(ParticipantProfileCard.createFromProfile(user, this));
        });
        let participantsPanelContent = "";
        this.participantProfileCards.forEach(card => {
            participantsPanelContent += card.create();
        })
        return `
            <div id="lobby-room-participants-content" class="h vh-t hv-l">
                ${participantsPanelContent}
            </div>
        `;
    }

    create() {
        let page = documentCreateElement("div", this.label, "page");

        page.innerHTML = `
            <div id="lobby-page-content" class="h hv-c vh-c">
                <div id="lobby-page-content-vert-wrapper" class="v vh-c hv-c">
                    ${this.createRoomInfoPanel()}
                    <div id="${this.roomParticipantsPanel.label}" class="panel h vh-c hv-c">
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
        this.app.savePageStateToHistory(true);
        super.show();
    }

    createRoomInfoPanel() {
        return `
            <div id="${this.roomInfoPanel.label}" class="panel">
                <div id="lobby-page-user-role-content-row" class="h hv-c vh-c">
                    <div id="${this.roomInfoUserRole.label}" class="text-info">
                    </div>
                </div>
                <div id="lobby-page-room-code-content-row" class="h hv-c vh-c">
                    <div>${this.ROOM_INFO_ROOM_CODE_HEADER_TEXT}</div>
                    <div id="${this.roomInfoRoomCode.label}" class="text-info">
                    </div>
                </div>
                <div id="lobby-page-room-passcode-content-row" class="h hv-c vh-c">
                    <div>${this.ROOM_INFO_ROOM_PASSCODE_HEADER_TEXT}</div>
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

class User {
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
                ${(this.isReady || this.isAdmin) ? `
                    <div class="participant-profile-ready-blocker">
                        ${this.isAdmin ? "" : "Ready!"}
                    </div>
                ` : ""}
                <div class="participant-profile-vert-wrapper v vh-c hv-c">
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

        this.PARTICIPANT_ROLE_SWITCHER_CONTENT_ID = "participant-role-switcher-content";
        this.ROLE_SELECTION_OPTION_CLASS = "role-switcher-selection-option";

        this.content = new Element("id", this.PARTICIPANT_ROLE_SWITCHER_CONTENT_ID);

        this.roleOptions = new Element("class", this.ROLE_SELECTION_OPTION_CLASS);

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
        });
    }

    createRoleAvatar(role, selectedRole) {
        let profileImgSrc = ProfileUtils.generateProfileImageFromCode(PROFILE_IMAGES_CODES[role][0]);
        let roleString = GameUtils.convertRoleToDisplayString(role);
        return `
            <div data-chosen-role="${role}" class="participant-profile-avatar role-switcher-selection-option ${selectedRole === role ? "this-role" : ""}">
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
                    <div id="${this.PARTICIPANT_ROLE_SWITCHER_CONTENT_ID}" class="h hv-c vh-c">
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