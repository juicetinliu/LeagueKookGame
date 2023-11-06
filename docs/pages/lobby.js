import { documentCreateElement, Element } from "../components.js";
import { GAME_ROLES, GameUtils } from "../game.js";
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

        this.waitListListener = null;
        this.lobbyListListener = null;

        this.reset();
    }

    reset() {
        this.roomId = null;
        this.roomPasscode = null;
        this.isAdmin = false;
        this.isRoomLocked = false;
        this.isReady = false;
    }

    setup(setupArgs) {
        let state = Object.values(this.pageState).length ? this.pageState : setupArgs;
        this.reset();
        this.updateRoomWhenParticipantsChange(null);

        this.setRoomParameters(state.roomId, state.roomPasscode, state.isAdmin, state.isRoomLocked, state.isReady);
        if(this.waitListListener) {
            this.waitListListener(); //unsubscribes the listener.
        }
        if(this.lobbyListListener) {
            this.lobbyListListener(); //unsubscribes the listener.
        }
        if(this.isAdmin) {
            this.waitListListener = this.app.fire.attachAdminWaitListListener(this.roomId);
            this.attachLobbyListListener();
        } else {
            this.waitListListener = this.app.fire.attachParticipantWaitListListener(this.roomId, () => {
                this.attachLobbyListListener();
                if(this.waitListListener) {
                    console.log("WaitList Listener removed");
                    this.waitListListener();
                }
            });
        }

        //We can reregister since we recreate the control panel content (listeners are lost)
        if(this.isAdmin) {
            this.roomControlsLockToggleButton.addEventListener(["click"], async () => {
                let newRoomLockState = !this.isRoomLocked;
                if(await this.app.fire.setRoomLock(this.roomId, newRoomLockState)) {
                    this.setRoomLockButton(newRoomLockState);
                    this.isRoomLocked = newRoomLockState;

                    this.pageState.isRoomLocked = this.isRoomLocked;
                    this.app.savePageStateToHistory(true);
                }
            });
            this.roomControlsCloseButton.addEventListener(["click"], async () => {
                await this.app.fire.closeRoom(this.roomId);
                this.pageState = {};
                this.app.goToPage(this.app.pages.index, {}, {}, null, false);
                this.app.savePageStateToHistory(true);
            });
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
            this.roomControlsLeaveButton.addEventListener(["click"], async () => {
                await this.app.fire.leaveRoom(this.roomId);
                this.pageState = {};
                this.app.goToPage(this.app.pages.index, {}, {}, null, false);
                this.app.savePageStateToHistory(true);
            });
        }
        super.setup();
    }

    attachLobbyListListener() {
        this.lobbyListListener = this.app.fire.attachLobbyListListener(this.roomId, (data) => { 
            this.updateRoomWhenParticipantsChange(data); 
        });
    }

    setRoomLockButton(isRoomLocked) {
        this.roomControlsLockToggleButton.getElement().innerHTML = isRoomLocked ? "Unlock Room" : "Lock Room";
    }


    setRoomReadyButton(isReady) {
        this.roomControlsReadyButton.getElement().innerHTML = isReady ? "Ready!" : "Not Ready!";
    }

    setRoomParameters(roomId, roomPasscode, isAdmin, isRoomLocked, isReady) {
        this.roomId = roomId;
        this.roomPasscode = roomPasscode;
        this.isAdmin = isAdmin;
        this.isRoomLocked = isRoomLocked;
        this.isReady = isReady;

        this.pageState.roomId = this.roomId;
        this.pageState.roomPasscode = this.roomPasscode;
        this.pageState.isAdmin = this.isAdmin;
        this.pageState.isRoomLocked = this.isRoomLocked;
        this.pageState.isReady = this.isReady;

        this.roomInfoUserRole.getElement().innerHTML = this.isAdmin ? "Admin" : "Participant"
        this.roomInfoRoomCode.getElement().innerHTML = this.roomId;
        this.roomInfoRoomPasscode.getElement().innerHTML = this.roomPasscode;
        this.roomControlsPanel.getElement().innerHTML = this.createRoomControlsPanelContent();
        if(this.isAdmin) {
            this.setRoomLockButton(this.isRoomLocked);
        } else {
            this.setRoomReadyButton(this.isReady);
        }
    }

    updateRoomWhenParticipantsChange(data) {
        console.log("Updating participants list:", data);
        this.roomParticipantsPanel.getElement().innerHTML = this.createParticipantsPanelContent(data);
        if(this.isAdmin) {
            if(data) {
                let participantData = Object.values(data);
                let allowStart = GameUtils.verifyGameStartCondition(null, participantData);
                this.roomControlsStartButton.getElement().disabled = !allowStart;
            } else {
                this.roomControlsStartButton.getElement().disabled = true;
            }
        }
    }

    createParticipantsPanelContent(participants) {
        let participantsPanelContent = this.generateParticipantProfileContent({
            name: GAME_ROLES.ADMIN,
            uid: GAME_ROLES.ADMIN,
            isReady: true,
        });
        if(!participants) return participantsPanelContent;
        Object.entries(participants).forEach(val => {
            participantsPanelContent += this.generateParticipantProfileContent({
                name: val[0],
                uid: val[0],
                isReady: val[1].isReady,
            })
        });
        return participantsPanelContent;
    }

    generateParticipantProfileContent(userParams) {
        let isUserAdmin = userParams.uid === GAME_ROLES.ADMIN
        let isCurrentUser = userParams.uid === this.app.fire.fireUser.uid || (this.isAdmin && isUserAdmin);
        return `
            <div id="participant-profile-${userParams.uid}" class="participant-profile-wrapper ${isCurrentUser ? "this-user" : ""}">
                <div class="participant-profile-vert-wrapper v vh-c hv-c">
                    <div class="participant-profile-avatar">
                        ${userParams.isReady 
                            ? (isUserAdmin ? "ADMIN" : "ready") 
                            : ""}
                    </div>
                    <div class="participant-profile-name">
                        ${userParams.name}
                    </div>
                </div>
            </div>
        `;
    }

    create() {
        let page = documentCreateElement("div", this.label, "page");

        page.innerHTML = `
            <div id="lobby-page-content" class="h hv-c vh-c">
                <div id="lobby-page-content-vert-wrapper" class="v vh-c hv-c">
                    ${this.createRoomInfoPanel()}
                    <div id="${this.roomParticipantsPanel.label}" class="panel h vh-t hv-l">
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
                    <button id="${this.roomControlsLockToggleButton.label}">
                        Lock Room
                    </button>
                    <button id="${this.roomControlsStartButton.label}">
                        Start!
                    </button>
                    <button id="${this.roomControlsCloseButton.label}">
                        Close
                    </button>
                ` : `
                    <button id="${this.roomControlsReadyButton.label}">
                        Ready!
                    </button>
                    <button id="${this.roomControlsLeaveButton.label}">
                        Leave
                    </button>
                `}
            </div>
        `;
    }
}